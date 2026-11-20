create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text unique,
  role text not null default 'customer'
    check (role in ('owner', 'admin', 'manager', 'tracking_team', 'field_officer', 'service_staff', 'customer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  title text not null unique,
  description text not null default '',
  icon text not null default 'sparkles',
  image_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id text primary key,
  category_id text not null references public.categories(id) on update cascade,
  title text not null,
  description text not null default '',
  price numeric(12, 2) not null default 0 check (price >= 0),
  image_url text not null default '',
  icon text not null default 'sparkles',
  tag text not null default '',
  active boolean not null default true,
  popular boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offers (
  id text primary key,
  title text not null,
  description text not null default '',
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  image_url text not null default '',
  coupon_code text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  active boolean not null default false,
  priority integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (discount_type <> 'percentage' or discount_value <= 100)
);

create table public.offer_services (
  offer_id text not null references public.offers(id) on delete cascade,
  service_id text not null references public.services(id) on delete cascade,
  primary key (offer_id, service_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, profile_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique default (
    'ETOE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  customer_id uuid references public.profiles(id),
  customer_name text not null,
  customer_phone text not null,
  service_id text not null references public.services(id),
  team_id uuid references public.teams(id),
  scheduled_date date not null,
  time_slot text not null,
  address text not null,
  instructions text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'Booking Confirmed'
    check (status in ('Booking Confirmed', 'Service Team Assigned', 'Team On The Way', 'Team Arrived at Customer Location', 'Service Started', 'Service Completed', 'Payment Completed', 'Cancelled')),
  payment_status text not null default 'Pending'
    check (payment_status in ('Pending', 'Authorized', 'Paid', 'Failed', 'Refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null check (status in (
    'Booking Confirmed', 'Service Team Assigned', 'Team On The Way',
    'Team Arrived at Customer Location', 'Service Started', 'Service Completed',
    'Payment Completed', 'Cancelled'
  )),
  note text not null default '',
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  assigned_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  provider text not null,
  provider_payment_id text unique,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'Pending'
    check (status in ('Pending', 'Authorized', 'Paid', 'Failed', 'Refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  address text not null,
  landmark text not null default '',
  city text not null default 'Jaipur',
  postal_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'sms', 'whatsapp', 'push', 'email')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (profile_id, work_date)
);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  photo_type text not null check (photo_type in ('before', 'after', 'inspection', 'other')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index services_category_active_idx on public.services(category_id, active, sort_order);
create index offers_active_window_idx on public.offers(active, starts_at, expires_at, priority desc);
create index bookings_customer_created_idx on public.bookings(customer_id, created_at desc);
create index bookings_status_date_idx on public.bookings(status, scheduled_date);
create index bookings_phone_idx on public.bookings(customer_phone);
create index booking_status_history_booking_idx on public.booking_status_history(booking_id, created_at);
create index assignments_team_idx on public.assignments(team_id, created_at desc);

create function public.has_any_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and active
      and role = any (allowed_roles)
  );
$$;

create function public.can_access_booking(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings booking
    where booking.id = target_booking_id
      and (
        booking.customer_id = (select auth.uid())
        or public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
        or exists (
          select 1
          from public.team_members member
          where member.team_id = booking.team_id
            and member.profile_id = (select auth.uid())
        )
      )
  );
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.has_any_role(array['owner']) then
    raise exception 'Only an owner can change account roles';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create function public.protect_assigned_staff_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_any_role(array['field_officer', 'service_staff'])
    and not public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
    and (
      new.customer_id is distinct from old.customer_id
      or new.customer_name is distinct from old.customer_name
      or new.customer_phone is distinct from old.customer_phone
      or new.service_id is distinct from old.service_id
      or new.team_id is distinct from old.team_id
      or new.scheduled_date is distinct from old.scheduled_date
      or new.time_slot is distinct from old.time_slot
      or new.address is distinct from old.address
      or new.instructions is distinct from old.instructions
      or new.amount is distinct from old.amount
      or new.payment_status is distinct from old.payment_status
      or new.booking_ref is distinct from old.booking_ref
    ) then
    raise exception 'Assigned field staff may only update booking status';
  end if;
  if new.status is distinct from old.status
    and public.has_any_role(array['field_officer', 'service_staff'])
    and not public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
    and not (
      (old.status = 'Service Team Assigned' and new.status = 'Team On The Way')
      or (old.status = 'Team On The Way' and new.status = 'Team Arrived at Customer Location')
      or (old.status = 'Team Arrived at Customer Location' and new.status = 'Service Started')
      or (old.status = 'Service Started' and new.status = 'Service Completed')
    ) then
    raise exception 'Field staff must update the job through its status sequence';
  end if;
  return new;
end;
$$;

create trigger protect_assigned_staff_booking_fields
  before update on public.bookings
  for each row execute function public.protect_assigned_staff_booking_fields();

create function public.validate_booking_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.bookings
  where id = new.booking_id;

  if current_status is null or new.status <> current_status then
    raise exception 'Status history must match the current booking status';
  end if;

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  new.created_at = now();
  return new;
end;
$$;

create trigger validate_booking_status_history
  before insert on public.booking_status_history
  for each row execute function public.validate_booking_status_history();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'categories', 'services', 'offers', 'teams',
    'bookings', 'assignments', 'payments', 'addresses'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.offers enable row level security;
alter table public.offer_services enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.assignments enable row level security;
alter table public.payments enable row level security;
alter table public.addresses enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.attendance enable row level security;
alter table public.job_photos enable row level security;

create policy "Profiles can be read by their owner and internal staff"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']));
create policy "Profiles can be updated by their owner or internal staff"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']))
  with check (id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']));

create policy "Active categories are public"
  on public.categories for select to anon, authenticated using (active or public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using (public.has_any_role(array['owner', 'admin']))
  with check (public.has_any_role(array['owner', 'admin']));

create policy "Active services are public"
  on public.services for select to anon, authenticated using (active or public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Admins and managers manage services"
  on public.services for all to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager']))
  with check (public.has_any_role(array['owner', 'admin', 'manager']));

create policy "Only live offers are public"
  on public.offers for select to anon, authenticated
  using (
    (active and starts_at <= now() and expires_at > now())
    or public.has_any_role(array['owner', 'admin', 'manager'])
  );
create policy "Admins manage offers"
  on public.offers for all to authenticated
  using (public.has_any_role(array['owner', 'admin']))
  with check (public.has_any_role(array['owner', 'admin']));
create policy "Live offer services are public"
  on public.offer_services for select to anon, authenticated
  using (exists (
    select 1 from public.offers offer
    where offer.id = offer_id
      and offer.active
      and offer.starts_at <= now()
      and offer.expires_at > now()
  ) or public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Admins manage offer services"
  on public.offer_services for all to authenticated
  using (public.has_any_role(array['owner', 'admin']))
  with check (public.has_any_role(array['owner', 'admin']));

create policy "Internal staff can view teams"
  on public.teams for select to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team', 'field_officer', 'service_staff']));
create policy "Managers manage teams"
  on public.teams for all to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager']))
  with check (public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Team members can view their team membership"
  on public.team_members for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']));
create policy "Managers manage team membership"
  on public.team_members for all to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager']))
  with check (public.has_any_role(array['owner', 'admin', 'manager']));

create policy "Customers and authorized staff can read bookings"
  on public.bookings for select to authenticated
  using (public.can_access_booking(id));
create policy "Internal roles update bookings"
  on public.bookings for update to authenticated
  using (
    public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
    or (
      public.has_any_role(array['field_officer', 'service_staff'])
      and exists (
        select 1 from public.team_members member
        where member.team_id = bookings.team_id
          and member.profile_id = (select auth.uid())
      )
    )
  )
  with check (
    public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
    or (
      public.has_any_role(array['field_officer', 'service_staff'])
      and exists (
        select 1 from public.team_members member
        where member.team_id = bookings.team_id
          and member.profile_id = (select auth.uid())
      )
    )
  );
create policy "Customers can read visible booking history"
  on public.booking_status_history for select to authenticated
  using (public.can_access_booking(booking_id));
create policy "Internal staff add status history"
  on public.booking_status_history for insert to authenticated
  with check (
    (
      public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
      or public.has_any_role(array['field_officer', 'service_staff'])
    )
    and exists (
      select 1 from public.bookings booking
      where booking.id = booking_id
        and (
          public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
          or exists (
            select 1 from public.team_members member
            where member.team_id = booking.team_id
              and member.profile_id = (select auth.uid())
          )
        )
    )
  );
create policy "Internal staff manage assignments"
  on public.assignments for all to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']))
  with check (public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']));

create policy "Customers and staff can read payments"
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.bookings booking
    where booking.id = booking_id
      and (booking.customer_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']))
  ));
create policy "Customers manage their own addresses"
  on public.addresses for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));
create policy "Published reviews are public"
  on public.reviews for select to anon, authenticated
  using (published or customer_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin']));
create policy "Customers can review their completed bookings"
  on public.reviews for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.bookings booking
      where booking.id = booking_id
        and booking.customer_id = (select auth.uid())
        and booking.status = 'Service Completed'
    )
  );
create policy "Admins moderate reviews"
  on public.reviews for update to authenticated
  using (public.has_any_role(array['owner', 'admin']))
  with check (public.has_any_role(array['owner', 'admin']));
create policy "Customers read their notifications"
  on public.notifications for select to authenticated using (profile_id = (select auth.uid()));
create policy "Customers mark their notifications read"
  on public.notifications for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "Staff can manage notifications"
  on public.notifications for all to authenticated
  using (public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']))
  with check (public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team']));
create policy "Staff read own attendance and managers read all"
  on public.attendance for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Staff manage own attendance"
  on public.attendance for all to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']))
  with check (profile_id = (select auth.uid()) or public.has_any_role(array['owner', 'admin', 'manager']));
create policy "Assigned staff and admins read job photos"
  on public.job_photos for select to authenticated
  using (
    uploaded_by = (select auth.uid())
    or public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team'])
    or exists (
      select 1
      from public.bookings booking
      join public.team_members member on member.team_id = booking.team_id
      where booking.id = booking_id
        and member.profile_id = (select auth.uid())
    )
  );
create policy "Assigned staff can add job photos"
  on public.job_photos for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.bookings booking
      where booking.id = booking_id
        and (
          public.has_any_role(array['owner', 'admin', 'manager'])
          or exists (
            select 1 from public.team_members member
            where member.team_id = booking.team_id
              and member.profile_id = (select auth.uid())
          )
        )
    )
  );

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.services, public.offers, public.offer_services, public.reviews to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.services, public.offers, public.offer_services, public.teams, public.team_members to authenticated;
grant select, update on public.teams, public.team_members to authenticated;
grant select, update on public.bookings to authenticated;
grant select, insert on public.booking_status_history to authenticated;
grant select, insert, update, delete on public.assignments, public.addresses, public.attendance to authenticated;
grant select on public.payments to authenticated;
grant insert, update on public.reviews to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert on public.job_photos to authenticated;
grant execute on function public.has_any_role(text[]) to anon, authenticated;
grant execute on function public.can_access_booking(uuid) to authenticated;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.protect_profile_role() from public;
revoke all on function public.protect_assigned_staff_booking_fields() from public;
revoke all on function public.validate_booking_status_history() from public;
revoke all on function public.set_updated_at() from public;

insert into public.categories (id, title, description, icon, image_url, sort_order) values
  ('housekeeping', 'Housekeeping', 'Everyday care for cleaner, more comfortable spaces.', 'home', 'photo-1581578731548-c64695cc6952', 1),
  ('ifm', 'IFM (Integrated Facility Management)', 'Coordinated facility operations and on-site management.', 'building', 'photo-1497366811353-6870744d04b2', 2),
  ('deep-cleaning', 'Deep Cleaning', 'Detailed cleans for the spaces and surfaces that need extra care.', 'sparkles', 'photo-1600585154340-be6161a56c0a', 3),
  ('pest-control', 'Pest Control', 'Practical pest treatments for homes and workplaces.', 'bug', 'photo-1584622650111-993a426fbf0a', 4),
  ('technical-maintenance', 'Technical & Maintenance', 'Skilled help for essential repairs and equipment upkeep.', 'wrench', 'photo-1621905251189-08b45d6a269e', 5),
  ('manpower', 'Manpower Services', 'Dependable staffing support for your day-to-day operations.', 'users', 'photo-1521737711867-e3b97375f902', 6)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;

insert into public.services (id, category_id, title, description, price, image_url, icon, tag, popular, sort_order) values
  ('regular-housekeeping', 'housekeeping', 'Regular Housekeeping', 'Reliable routine cleaning and upkeep tailored to your space.', 799, 'photo-1581578731548-c64695cc6952', 'home', '', false, 1),
  ('home-cleaning', 'housekeeping', 'Home Cleaning', 'Refresh your everyday living spaces with a careful home clean.', 1499, 'photo-1600210492486-724fe5c67fb0', 'home', 'Popular', true, 2),
  ('office-cleaning', 'housekeeping', 'Office Cleaning', 'Keep your workplace clean, comfortable and ready for the team.', 2499, 'photo-1497366754035-f200968a6e72', 'building', '', false, 3),
  ('bathroom-cleaning', 'housekeeping', 'Bathroom Cleaning', 'A focused clean for bathroom floors, fixtures and surfaces.', 599, 'photo-1620626011761-996317b8d101', 'droplets', '', false, 4),
  ('kitchen-cleaning', 'housekeeping', 'Kitchen Cleaning', 'Detailed cleaning for kitchen counters, cupboards and appliances.', 899, 'photo-1556911220-e15b29be8c8f', 'sparkles', '', false, 5),
  ('floor-cleaning', 'housekeeping', 'Floor Cleaning', 'A thorough clean to help floors look their best.', 699, 'photo-1600607687939-ce8a6c25118c', 'layers', '', false, 6),
  ('glass-cleaning', 'housekeeping', 'Glass Cleaning', 'Streak-conscious cleaning for windows and glass surfaces.', 899, 'photo-1524758631624-e2822e304c36', 'sparkles', '', false, 7),
  ('ifms', 'ifm', 'Integrated Facility Management', 'A coordinated approach to facility services and site operations.', 0, 'photo-1497366811353-6870744d04b2', 'building', 'Enquiry', false, 1),
  ('facility-operations', 'ifm', 'Facility Operations', 'Reliable day-to-day coordination for your managed facilities.', 0, 'photo-1497366754035-f200968a6e72', 'building', 'Enquiry', false, 2),
  ('housekeeping-management', 'ifm', 'Housekeeping Management', 'Managed housekeeping operations for professional environments.', 0, 'photo-1521737711867-e3b97375f902', 'users', 'Enquiry', false, 3),
  ('facility-supervision', 'ifm', 'Facility Supervision', 'On-site supervision to support consistent service delivery.', 0, 'photo-1497366754035-f200968a6e72', 'badge', 'Enquiry', false, 4),
  ('office-maintenance', 'ifm', 'Office Maintenance', 'Practical ongoing maintenance support for office facilities.', 0, 'photo-1497366811353-6870744d04b2', 'wrench', 'Enquiry', false, 5),
  ('home', 'deep-cleaning', 'Full Home Deep Cleaning', 'A complete top-to-bottom refresh for kitchens, bathrooms and living spaces.', 2499, 'photo-1581578731548-c64695cc6952', 'home', 'Bestseller', true, 1),
  ('bathroom', 'deep-cleaning', 'Bathroom Deep Cleaning', 'Targeted bathroom cleaning for tiles, fixtures and hard-to-reach corners.', 699, 'photo-1620626011761-996317b8d101', 'droplets', '', false, 2),
  ('kitchen', 'deep-cleaning', 'Kitchen Deep Cleaning', 'Bring back the sparkle with a detailed clean of your kitchen surfaces.', 999, 'photo-1556911220-e15b29be8c8f', 'sparkles', '', false, 3),
  ('sofa', 'deep-cleaning', 'Sofa Cleaning', 'Lift everyday dirt and refresh upholstery with expert care.', 799, 'photo-1555041469-a586c61ea9bc', 'sofa', 'Popular', true, 4),
  ('carpet', 'deep-cleaning', 'Carpet Cleaning', 'A deep clean for carpets and rugs to refresh the rooms you live in.', 999, 'photo-1600210492486-724fe5c67fb0', 'layers', '', false, 5),
  ('mattress-cleaning', 'deep-cleaning', 'Mattress Cleaning', 'A careful refresh for the surface where you rest every day.', 899, 'photo-1631049307264-da0ec9d70304', 'layers', '', false, 6),
  ('office', 'deep-cleaning', 'Office Deep Cleaning', 'A healthier, cleaner workplace with a professional site-ready team.', 4799, 'photo-1497366754035-f200968a6e72', 'building', '', false, 7),
  ('move-cleaning', 'deep-cleaning', 'Move-in / Move-out Cleaning', 'Prepare a property for its next chapter with a detailed clean.', 2999, 'photo-1600607687939-ce8a6c25118c', 'home', '', false, 8),
  ('cockroach-control', 'pest-control', 'Cockroach Control', 'Targeted treatment to help manage cockroach activity.', 899, 'photo-1584622650111-993a426fbf0a', 'bug', '', false, 1),
  ('termite-control', 'pest-control', 'Termite Control', 'Assessment and treatment options for termite concerns.', 1999, 'photo-1600607687939-ce8a6c25118c', 'bug', '', false, 2),
  ('mosquito-control', 'pest-control', 'Mosquito Control', 'Treatment options to help reduce mosquito activity.', 999, 'photo-1500382017468-9049fed747ef', 'bug', '', false, 3),
  ('rodent-control', 'pest-control', 'Rodent Control', 'Practical rodent management for residential and business spaces.', 1199, 'photo-1584622650111-993a426fbf0a', 'bug', '', false, 4),
  ('pest', 'pest-control', 'General Pest Control', 'Reliable home and commercial pest treatment options.', 999, 'photo-1584622650111-993a426fbf0a', 'bug', '', false, 5),
  ('electrical-services', 'technical-maintenance', 'Electrical Services', 'Help with common electrical repairs and installations.', 499, 'photo-1621905251189-08b45d6a269e', 'wrench', '', false, 1),
  ('plumbing', 'technical-maintenance', 'Plumbing', 'Support for leaks, fittings and everyday plumbing needs.', 499, 'photo-1607472586893-edb57bdc0e39', 'droplets', '', false, 2),
  ('ac-services', 'technical-maintenance', 'AC Services', 'Maintenance and service support for your air conditioner.', 799, 'photo-1581092921461-eab62e97a780', 'wrench', '', false, 3),
  ('equipment-maintenance', 'technical-maintenance', 'Equipment Maintenance', 'Scheduled support to help keep essential equipment running.', 0, 'photo-1581092921461-eab62e97a780', 'wrench', 'Enquiry', false, 4),
  ('general-repairs', 'technical-maintenance', 'General Repairs', 'Practical repair help for common household and workplace issues.', 499, 'photo-1581578731548-c64695cc6952', 'wrench', '', false, 5),
  ('office-staff', 'manpower', 'Office Staff', 'Staffing support for day-to-day office operations.', 0, 'photo-1521737711867-e3b97375f902', 'users', 'Enquiry', false, 1),
  ('housekeeping-staff', 'manpower', 'Housekeeping Staff', 'Dependable housekeeping staff for your premises.', 0, 'photo-1581578731548-c64695cc6952', 'users', 'Enquiry', false, 2),
  ('pantry-staff', 'manpower', 'Pantry Staff', 'Pantry team staffing tailored to your workplace needs.', 0, 'photo-1556911220-e15b29be8c8f', 'users', 'Enquiry', false, 3),
  ('facility-staff', 'manpower', 'Facility Staff', 'On-site staffing support for facility operations.', 0, 'photo-1497366811353-6870744d04b2', 'users', 'Enquiry', false, 4),
  ('temporary-manpower', 'manpower', 'Temporary Manpower', 'Flexible short-term staffing for changing requirements.', 0, 'photo-1521737711867-e3b97375f902', 'users', 'Enquiry', false, 5),
  ('contract-manpower', 'manpower', 'Contract Manpower', 'Contract staffing solutions for ongoing operational needs.', 0, 'photo-1521737711867-e3b97375f902', 'users', 'Enquiry', false, 6)
on conflict (id) do update set
  category_id = excluded.category_id,
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  image_url = excluded.image_url,
  icon = excluded.icon,
  tag = excluded.tag,
  popular = excluded.popular,
  sort_order = excluded.sort_order;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-images', 'offer-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Offer images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'offer-images');
create policy "Admins upload offer images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'offer-images'
    and public.has_any_role(array['owner', 'admin'])
  );
create policy "Admins update offer images"
  on storage.objects for update to authenticated
  using (bucket_id = 'offer-images' and public.has_any_role(array['owner', 'admin']))
  with check (bucket_id = 'offer-images' and public.has_any_role(array['owner', 'admin']));
create policy "Admins delete offer images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'offer-images' and public.has_any_role(array['owner', 'admin']));

create policy "Assigned staff upload job photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.bookings booking
      where booking.id::text = (storage.foldername(name))[2]
        and (
          public.has_any_role(array['owner', 'admin', 'manager'])
          or exists (
            select 1 from public.team_members member
            where member.team_id = booking.team_id
              and member.profile_id = (select auth.uid())
          )
        )
    )
  );
create policy "Assigned staff read job photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1
      from public.bookings booking
      where booking.id::text = (storage.foldername(name))[2]
        and (
          public.has_any_role(array['owner', 'admin', 'manager', 'tracking_team', 'field_officer'])
          or exists (
            select 1 from public.team_members member
            where member.team_id = booking.team_id
              and member.profile_id = (select auth.uid())
          )
        )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_status_history'
  ) then
    alter publication supabase_realtime add table public.booking_status_history;
  end if;
end;
$$;
