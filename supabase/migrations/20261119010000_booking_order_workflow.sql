alter table public.bookings
  add column if not exists admin_status text not null default 'Pending Admin Confirmation'
    check (admin_status in ('Pending Admin Confirmation','Confirmed','Rejected','Cancelled')),
  add column if not exists acceptance_status text not null default 'Not Assigned'
    check (acceptance_status in ('Not Assigned','Awaiting Team Acceptance','Accepted','Rejected','Acceptance Timeout')),
  add column if not exists acceptance_deadline timestamptz,
  add column if not exists assigned_team_id uuid references public.teams(id),
  add column if not exists accepted_by uuid references public.profiles(id),
  add column if not exists accepted_at timestamptz,
  add column if not exists rejection_reason text not null default '',
  add column if not exists estimated_arrival timestamptz,
  add column if not exists service_completed_at timestamptz,
  add column if not exists order_version integer not null default 1,
  add column if not exists rescheduled_at timestamptz;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check check (status in (
    'Booking Confirmed','Order Confirmed','Service Team Assigned','Team Accepted',
    'Team On The Way','Team Arrived at Customer Location','Service Started',
    'Service Completed','Payment Completed','Acceptance Pending','Team Rejected','Cancelled'
  ));

alter table public.booking_status_history drop constraint if exists booking_status_history_status_check;
alter table public.booking_status_history
  add constraint booking_status_history_status_check check (status in (
    'Booking Confirmed','Order Confirmed','Service Team Assigned','Team Accepted',
    'Team On The Way','Team Arrived at Customer Location','Service Started',
    'Service Completed','Payment Completed','Acceptance Pending','Team Rejected','Cancelled'
  ));

alter table public.notifications
  add column if not exists type text not null default 'general',
  add column if not exists title text not null default '',
  add column if not exists link text not null default '',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists event_key text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists delivery_state text not null default 'pending'
    check (delivery_state in ('pending','sent','failed','read'));

create unique index if not exists notifications_event_profile_unique
  on public.notifications(profile_id, event_key)
  where event_key is not null;

create table if not exists public.booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null,
  previous_status text,
  next_status text,
  previous_team_id uuid references public.teams(id),
  next_team_id uuid references public.teams(id),
  actor_id uuid references public.profiles(id),
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  popup_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  push_enabled boolean not null default false,
  sound_name text not null default 'etoe-order-alert',
  updated_at timestamptz not null default now()
);

create index if not exists bookings_admin_status_idx on public.bookings(admin_status, created_at desc);
create index if not exists bookings_acceptance_status_idx on public.bookings(acceptance_status, acceptance_deadline);
create index if not exists bookings_team_status_idx on public.bookings(assigned_team_id, status, acceptance_status);
create index if not exists notifications_profile_read_idx on public.notifications(profile_id, read_at, created_at desc);
create index if not exists booking_audit_booking_idx on public.booking_audit_log(booking_id, created_at desc);

alter table public.booking_audit_log enable row level security;
alter table public.notification_settings enable row level security;

create policy "Authorized staff read booking audit"
  on public.booking_audit_log for select to authenticated
  using (public.has_any_role(array['owner','admin','manager','tracking_team','field_officer','service_staff']));
create policy "System and staff insert booking audit"
  on public.booking_audit_log for insert to authenticated
  with check (public.has_any_role(array['owner','admin','manager','tracking_team','field_officer','service_staff']));

create policy "Users read and update notification settings"
  on public.notification_settings for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['notifications','bookings','booking_status_history','booking_audit_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

create or replace function public.insert_order_notification(
  target_profile_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  notification_link text,
  notification_payload jsonb default '{}'::jsonb,
  notification_event_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  insert into public.notifications (
    profile_id, type, title, message, channel, link, payload, event_key, delivery_state
  ) values (
    target_profile_id, notification_type, notification_title, notification_message,
    'in_app', notification_link, notification_payload, notification_event_key, 'pending'
  )
  on conflict (profile_id, event_key) do nothing
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.create_customer_booking(
  p_service_id text,
  p_customer_name text,
  p_customer_phone text,
  p_scheduled_date date,
  p_time_slot text,
  p_address text,
  p_instructions text default '',
  p_amount numeric default 0
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  target_profile record;
  service_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(p_customer_name)) < 2 or length(trim(p_customer_phone)) < 8 then
    raise exception 'Valid customer name and phone are required';
  end if;
  if p_scheduled_date < current_date then
    raise exception 'Scheduled date cannot be in the past';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and active) then
    raise exception 'Service not found';
  end if;

  select price into service_amount from public.services where id = p_service_id and active;

  insert into public.bookings (
    customer_id, customer_name, customer_phone, service_id, scheduled_date,
    time_slot, address, instructions, amount, status, payment_status,
    admin_status, acceptance_status
  ) values (
    auth.uid(), trim(p_customer_name), trim(p_customer_phone), p_service_id, p_scheduled_date,
    trim(p_time_slot), trim(p_address), coalesce(trim(p_instructions), ''),
    greatest(coalesce(service_amount, p_amount, 0), 0), 'Booking Confirmed', 'Pending',
    'Pending Admin Confirmation', 'Not Assigned'
  ) returning * into booking;

  insert into public.booking_status_history (
    booking_id, status, note, updated_by
  ) values (
    booking.id, 'Booking Confirmed', 'Customer created booking', auth.uid()
  );

  insert into public.booking_audit_log (
    booking_id, action, next_status, actor_id, metadata
  ) values (
    booking.id, 'Customer Booking Created', 'Booking Confirmed', auth.uid(),
    jsonb_build_object('booking_ref', booking.booking_ref, 'service_id', p_service_id)
  );

  for target_profile in
    select id from public.profiles where role in ('owner','admin') and active
  loop
    perform public.insert_order_notification(
      target_profile.id,
      'new_booking',
      'New booking received',
      format('%s · %s · %s', booking.booking_ref, p_customer_name, p_service_id),
      '#tracking/' || booking.id::text,
      jsonb_build_object(
        'booking_id', booking.id,
        'booking_ref', booking.booking_ref,
        'customer_name', p_customer_name,
        'service_id', p_service_id,
        'scheduled_date', p_scheduled_date,
        'time_slot', p_time_slot,
        'address', p_address,
        'amount', booking.amount,
        'payment_status', 'Pending'
      ),
      'new_booking:' || booking.id::text
    );
  end loop;
  return booking;
end;
$$;

create or replace function public.admin_confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  target_profile record;
begin
  if not public.has_any_role(array['owner','admin']) then
    raise exception 'Only owner or admin can confirm bookings';
  end if;
  select * into booking from public.bookings where id = p_booking_id for update;
  if booking.id is null then raise exception 'Booking not found'; end if;
  if booking.admin_status <> 'Pending Admin Confirmation' then
    raise exception 'Booking is not awaiting admin confirmation';
  end if;

  update public.bookings
  set admin_status = 'Confirmed',
      acceptance_status = case when assigned_team_id is not null then 'Awaiting Team Acceptance' else 'Not Assigned' end,
      acceptance_deadline = case
        when assigned_team_id is not null then now() + interval '10 minutes'
        else null
      end,
      status = 'Order Confirmed',
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;

  insert into public.booking_status_history (
    booking_id, status, note, updated_by
  ) values (p_booking_id, 'Order Confirmed', 'Admin confirmed order', auth.uid());

  insert into public.booking_audit_log (
    booking_id, action, previous_status, next_status, previous_team_id, next_team_id,
    actor_id, metadata
  ) values (
    p_booking_id, 'Admin Confirmed Order',     'Booking Confirmed', 'Order Confirmed',
    null, booking.assigned_team_id, auth.uid(),
    jsonb_build_object('booking_ref', booking.booking_ref)
  );

  if booking.customer_id is not null then
    perform public.insert_order_notification(
      booking.customer_id, 'booking_confirmed', 'Booking confirmed',
      format('ETOE has confirmed %s', booking.booking_ref),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'status', 'Service Team Assigned'),
      'admin_confirmed:' || booking.id::text
    );
  end if;

  for target_profile in
    select distinct member.profile_id as id
    from public.team_members member
    where member.team_id = booking.assigned_team_id
  loop
    perform public.insert_order_notification(
      target_profile.id, 'new_team_order', 'New order for your team',
      format('%s · %s', booking.booking_ref, booking.customer_name),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'booking_ref', booking.booking_ref),
      'team_order:' || booking.id::text
    );
  end loop;
  return booking;
end;
$$;

create or replace function public.admin_reject_booking(p_booking_id uuid, p_reason text default '')
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings;
begin
  if not public.has_any_role(array['owner','admin']) then
    raise exception 'Only owner or admin can reject bookings';
  end if;
  update public.bookings
  set admin_status = 'Rejected',
      acceptance_status = 'Not Assigned',
      status = 'Cancelled',
      rejection_reason = coalesce(trim(p_reason),''),
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;
  if booking.id is null then raise exception 'Booking not found'; end if;

  insert into public.booking_status_history (
    booking_id, status, note, updated_by
  ) values (p_booking_id, 'Cancelled', 'Admin rejected booking', auth.uid());
  insert into public.booking_audit_log (
    booking_id, action, previous_status, next_status, actor_id, reason
  ) values (
    p_booking_id, 'Admin Rejected Order', 'Booking Confirmed', 'Cancelled', auth.uid(),
    coalesce(trim(p_reason),'')
  );
  if booking.customer_id is not null then
    perform public.insert_order_notification(
      booking.customer_id, 'booking_rejected', 'Booking update',
      format('%s was not confirmed by ETOE', booking.booking_ref),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'reason', p_reason),
      'booking_rejected:' || booking.id::text
    );
  end if;
  return booking;
end;
$$;

create or replace function public.assign_booking_team(p_booking_id uuid, p_team_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings;
  previous_team uuid;
  target_profile record;
begin
  if not public.has_any_role(array['owner','admin','manager','tracking_team']) then
    raise exception 'Only authorized operations staff can assign teams';
  end if;
  select assigned_team_id into previous_team from public.bookings where id = p_booking_id;
  update public.bookings
  set assigned_team_id = p_team_id,
      team_id = p_team_id,
      acceptance_status = 'Awaiting Team Acceptance',
      acceptance_deadline = now() + interval '10 minutes',
      status = case when status = 'Booking Confirmed' then 'Service Team Assigned' else status end,
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;
  if booking.id is null then raise exception 'Booking not found'; end if;

  insert into public.booking_audit_log (
    booking_id, action, previous_team_id, next_team_id, actor_id,
    metadata
  ) values (
    p_booking_id,
    case when previous_team is null then 'Team Assigned' else 'Team Reassigned' end,
    previous_team, p_team_id, auth.uid(),
    jsonb_build_object('booking_ref', booking.booking_ref)
  );

  for target_profile in
    select distinct member.profile_id as id
    from public.team_members member
    where member.team_id = p_team_id
  loop
    perform public.insert_order_notification(
      target_profile.id, 'new_team_order', 'Order assigned to team',
      format('%s · Reply within 10 minutes', booking.booking_ref),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'deadline', booking.acceptance_deadline),
      'team_assignment:' || booking.id::text || ':' || p_team_id::text
    );
  end loop;
  return booking;
end;
$$;

create or replace function public.team_accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings;
  is_assigned_member boolean;
  target_profile record;
  previous_team uuid;
begin
  select exists(
    select 1 from public.team_members member
    join public.bookings b on b.assigned_team_id = member.team_id
    where b.id = p_booking_id and member.profile_id = auth.uid()
  ) into is_assigned_member;
  if not is_assigned_member then raise exception 'Only an assigned team member can accept this order'; end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if booking.acceptance_status <> 'Awaiting Team Acceptance' then
    raise exception 'Order is not awaiting team acceptance';
  end if;
  if booking.acceptance_deadline is not null and booking.acceptance_deadline < now() then
    raise exception 'Team acceptance deadline has expired';
  end if;

  select assigned_team_id into previous_team
  from public.bookings where id = p_booking_id;
  update public.bookings
  set acceptance_status = 'Accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      status = 'Team Accepted',
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;

  insert into public.booking_status_history (
    booking_id, status, note, updated_by
  ) values (p_booking_id, 'Team Accepted', 'Assigned team accepted order', auth.uid());
  insert into public.booking_audit_log (
    booking_id, action, previous_status, next_status, previous_team_id, next_team_id,
    actor_id, metadata
  ) values (
    p_booking_id, 'Team Accepted Order', 'Service Team Assigned', 'Team Accepted',
    booking.assigned_team_id, booking.assigned_team_id, auth.uid(),
    jsonb_build_object('accepted_at', booking.accepted_at)
  );

  for target_profile in
    select id from public.profiles where role in ('owner','admin','manager','tracking_team') and active
  loop
    perform public.insert_order_notification(
      target_profile.id, 'team_accepted', 'Team accepted the order',
      format('%s accepted %s', auth.uid(), booking.booking_ref),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'accepted_by', auth.uid()),
      'team_accepted:' || booking.id::text
    );
  end loop;
  if booking.customer_id is not null then
    perform public.insert_order_notification(
      booking.customer_id, 'team_accepted', 'Your service team accepted',
      format('A team has accepted %s', booking.booking_ref),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'status', 'Team Accepted'),
      'customer_team_accepted:' || booking.id::text
    );
  end if;
  return booking;
end;
$$;

create or replace function public.team_reject_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings;
  is_assigned_member boolean;
  target_profile record;
  previous_team uuid;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'A rejection reason is required'; end if;
  select exists(
    select 1 from public.team_members member
    join public.bookings b on b.assigned_team_id = member.team_id
    where b.id = p_booking_id and member.profile_id = auth.uid()
  ) into is_assigned_member;
  if not is_assigned_member then raise exception 'Only an assigned team member can reject this order'; end if;

  select assigned_team_id into previous_team
  from public.bookings where id = p_booking_id;
  update public.bookings
  set acceptance_status = 'Rejected',
      rejection_reason = trim(p_reason),
      status = 'Team Rejected',
      assigned_team_id = null,
      team_id = null,
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;
  if booking.id is null then raise exception 'Booking not found'; end if;

  insert into public.booking_audit_log (
    booking_id, action, previous_status, next_status, previous_team_id, actor_id, reason
  ) values (
    p_booking_id, 'Team Rejected Order', 'Service Team Assigned', 'Team Rejected',
    previous_team, auth.uid(), trim(p_reason)
  );

  for target_profile in
    select id from public.profiles where role in ('owner','admin','manager','tracking_team') and active
  loop
    perform public.insert_order_notification(
      target_profile.id, 'team_rejected', 'Team rejected an order',
      format('%s · %s', booking.booking_ref, trim(p_reason)),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'reason', trim(p_reason)),
      'team_rejected:' || booking.id::text
    );
  end loop;
  return booking;
end;
$$;

create or replace function public.expire_unaccepted_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare expired_count integer;
  booking record;
  target_profile record;
begin
  for booking in
    select * from public.bookings
    where acceptance_status = 'Awaiting Team Acceptance'
      and acceptance_deadline is not null
      and acceptance_deadline < now()
    for update
  loop
    update public.bookings
    set acceptance_status = 'Acceptance Timeout',
        status = 'Acceptance Pending',
        order_version = order_version + 1
    where id = booking.id;
    insert into public.booking_audit_log (
      booking_id, action, previous_status, next_status, previous_team_id, metadata
    ) values (
      booking.id, 'Acceptance Timeout', 'Team Accepted', 'Acceptance Pending',
      booking.assigned_team_id, jsonb_build_object('deadline', booking.acceptance_deadline)
    );
    for target_profile in
      select id from public.profiles where role in ('owner','admin','manager','tracking_team') and active
    loop
      perform public.insert_order_notification(
        target_profile.id, 'acceptance_timeout', 'Team acceptance timed out',
        format('%s requires reassignment', booking.booking_ref),
        '#tracking/' || booking.id::text,
        jsonb_build_object('booking_id', booking.id),
        'acceptance_timeout:' || booking.id::text
      );
    end loop;
  end loop;
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.update_booking_service_status(p_booking_id uuid, p_status text)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare booking public.bookings;
  is_authorized boolean;
  target_profile record;
begin
  select exists(
    select 1 from public.team_members member
    join public.bookings b on b.assigned_team_id = member.team_id
    where b.id = p_booking_id and member.profile_id = auth.uid()
  ) into is_authorized;
  if not is_authorized and not public.has_any_role(array['owner','admin','manager','tracking_team']) then
    raise exception 'Not authorized to update this booking';
  end if;
  if p_status not in (
    'Service Team Assigned','Team Accepted','Team On The Way',
    'Team Arrived at Customer Location','Service Started','Service Completed','Payment Completed'
  ) then
    raise exception 'Invalid service status';
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  update public.bookings
  set status = p_status,
      acceptance_status = case when p_status = 'Team Accepted' then 'Accepted' else acceptance_status end,
      estimated_arrival = case when p_status = 'Team On The Way' then coalesce(estimated_arrival, now() + interval '45 minutes') else estimated_arrival end,
      service_completed_at = case when p_status = 'Service Completed' then now() else service_completed_at end,
      payment_status = case when p_status = 'Payment Completed' then 'Paid' else payment_status end,
      order_version = order_version + 1
  where id = p_booking_id
  returning * into booking;

  insert into public.booking_status_history (
    booking_id, status, note, updated_by
  ) values (p_booking_id, p_status, 'Team or authorized operations update', auth.uid());
  insert into public.booking_audit_log (
    booking_id, action, previous_status, next_status, actor_id, metadata
  ) values (
    p_booking_id, 'Booking Status Updated', booking.status, p_status, auth.uid(),
    jsonb_build_object('service_completed_at', booking.service_completed_at)
  );

  for target_profile in
    select id from public.profiles
    where role in ('owner','admin','manager','tracking_team') and active
  loop
    perform public.insert_order_notification(
      target_profile.id, 'booking_status', 'Booking status updated',
      format('%s · %s', booking.booking_ref, p_status),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'status', p_status),
      'status:' || booking.id::text || ':' || p_status
    );
  end loop;
  if booking.customer_id is not null then
    perform public.insert_order_notification(
      booking.customer_id, 'booking_status', 'Booking status updated',
      format('%s · %s', booking.booking_ref, p_status),
      '#tracking/' || booking.id::text,
      jsonb_build_object('booking_id', booking.id, 'status', p_status),
      'customer_status:' || booking.id::text || ':' || p_status
    );
  end if;
  return booking;
end;
$$;

grant execute on function public.create_customer_booking(text,text,text,date,text,text,text,numeric) to authenticated;
grant execute on function public.admin_confirm_booking(uuid) to authenticated;
grant execute on function public.admin_reject_booking(uuid,text) to authenticated;
grant execute on function public.assign_booking_team(uuid,uuid) to authenticated;
grant execute on function public.team_accept_booking(uuid) to authenticated;
grant execute on function public.team_reject_booking(uuid,text) to authenticated;
grant execute on function public.expire_unaccepted_orders() to authenticated;
grant execute on function public.update_booking_service_status(uuid,text) to authenticated;

create or replace function public.retry_failed_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare retried_count integer;
begin
  if not public.has_any_role(array['owner','admin','manager','tracking_team']) then
    raise exception 'Only authorized operations staff can retry notifications';
  end if;
  update public.notifications
  set delivery_state = 'pending',
      retry_count = retry_count + 1
  where delivery_state = 'failed'
    and profile_id = auth.uid()
    and retry_count < 5;
  get diagnostics retried_count = row_count;
  return retried_count;
end;
$$;

create or replace function public.mark_notification_sent(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare notification public.notifications;
begin
  update public.notifications
  set delivery_state = 'sent',
      sent_at = now(),
      read_at = case when delivery_state = 'read' then read_at else read_at end
  where id = p_notification_id
    and profile_id = auth.uid()
  returning * into notification;
  if notification.id is null then raise exception 'Notification not found'; end if;
  return notification;
end;
$$;

grant execute on function public.retry_failed_notifications() to authenticated;
grant execute on function public.mark_notification_sent(uuid) to authenticated;
