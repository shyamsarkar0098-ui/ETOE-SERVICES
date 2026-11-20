alter table public.offers
  add column if not exists min_booking_amount numeric(12, 2) not null default 0 check (min_booking_amount >= 0),
  add column if not exists max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  add column if not exists redemption_count integer not null default 0 check (redemption_count >= 0);

create unique index if not exists offers_coupon_code_unique
  on public.offers (upper(coupon_code))
  where coupon_code is not null;

alter table public.bookings
  add column if not exists amount_before_discounts numeric(12, 2) not null default 0,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount numeric(12, 2) not null default 0,
  add column if not exists reward_discount numeric(12, 2) not null default 0,
  add column if not exists reward_points_redeemed integer not null default 0,
  add column if not exists rewards_processed_at timestamptz;

update public.bookings
set amount_before_discounts = amount
where amount_before_discounts = 0 and amount > 0;

alter table public.reviews
  add column if not exists service_id text references public.services(id) on delete set null;

update public.reviews review
set service_id = booking.service_id
from public.bookings booking
where review.booking_id = booking.id
  and review.service_id is null;

create index if not exists reviews_published_service_idx
  on public.reviews(service_id, created_at desc)
  where published;

create or replace function public.set_review_service_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select booking.service_id into new.service_id
  from public.bookings booking
  where booking.id = new.booking_id
    and booking.customer_id = new.customer_id
    and booking.status = 'Service Completed';
  if new.service_id is null then raise exception 'A review requires the customer completed booking'; end if;
  return new;
end;
$$;

drop trigger if exists set_review_service_id_trigger on public.reviews;
create trigger set_review_service_id_trigger
  before insert or update of booking_id, customer_id on public.reviews
  for each row execute function public.set_review_service_id();

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id text not null references public.services(id),
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists booking_items_booking_idx on public.booking_items(booking_id);

create table if not exists public.customer_cart_items (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_id text not null references public.services(id),
  quantity integer not null default 1 check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, service_id)
);

create table if not exists public.loyalty_settings (
  singleton boolean primary key default true check (singleton),
  active boolean not null default false,
  points_per_100 numeric(8, 2) not null default 0 check (points_per_100 >= 0),
  point_value numeric(8, 2) not null default 0 check (point_value >= 0),
  first_booking_bonus integer not null default 0 check (first_booking_bonus >= 0),
  referral_referrer_bonus integer not null default 0 check (referral_referrer_bonus >= 0),
  referral_customer_bonus integer not null default 0 check (referral_customer_bonus >= 0),
  point_expiry_days integer not null default 0 check (point_expiry_days >= 0),
  gold_spend_threshold numeric(12, 2) not null default 0 check (gold_spend_threshold >= 0),
  platinum_spend_threshold numeric(12, 2) not null default 0 check (platinum_spend_threshold >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (platinum_spend_threshold = 0 or gold_spend_threshold = 0 or platinum_spend_threshold >= gold_spend_threshold)
);

insert into public.loyalty_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.customer_rewards (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  referral_code text not null unique,
  points_balance integer not null default 0 check (points_balance >= 0),
  total_points_earned integer not null default 0 check (total_points_earned >= 0),
  total_points_redeemed integer not null default 0 check (total_points_redeemed >= 0),
  lifetime_spend numeric(12, 2) not null default 0 check (lifetime_spend >= 0),
  membership_level text not null default 'Silver' check (membership_level in ('Silver','Gold','Platinum')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  transaction_type text not null check (transaction_type in (
    'booking_earned','first_booking_bonus','referral_bonus','redemption','manual_adjustment','expiry'
  )),
  points_delta integer not null check (points_delta <> 0 or transaction_type = 'expiry'),
  reason text not null,
  event_key text not null unique,
  actor_id uuid references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reward_transactions_profile_created_idx
  on public.reward_transactions(profile_id, created_at desc);
create index if not exists reward_transactions_expiry_idx
  on public.reward_transactions(profile_id, expires_at)
  where expires_at is not null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_profile_id uuid not null references public.profiles(id) on delete cascade,
  referred_profile_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  qualifying_booking_id uuid unique references public.bookings(id) on delete set null,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_profile_id <> referred_profile_id)
);

create index if not exists referrals_referrer_created_idx
  on public.referrals(referrer_profile_id, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_profile_created_idx
  on public.support_tickets(profile_id, created_at desc);

alter table public.booking_items enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.loyalty_settings enable row level security;
alter table public.customer_rewards enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "Customers read their booking items" on public.booking_items;
create policy "Customers read their booking items"
  on public.booking_items for select to authenticated
  using (public.can_access_booking(booking_id));

drop policy if exists "Customers manage their own cart" on public.customer_cart_items;
create policy "Customers manage their own cart"
  on public.customer_cart_items for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.services service where service.id = service_id and service.active)
  );

drop policy if exists "Customers read loyalty settings" on public.loyalty_settings;
create policy "Customers read loyalty settings"
  on public.loyalty_settings for select to authenticated using (true);
drop policy if exists "Admins manage loyalty settings" on public.loyalty_settings;
create policy "Admins manage loyalty settings"
  on public.loyalty_settings for update to authenticated
  using (public.has_any_role(array['owner','admin']))
  with check (public.has_any_role(array['owner','admin']));

drop policy if exists "Customers read own rewards" on public.customer_rewards;
create policy "Customers read own rewards"
  on public.customer_rewards for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner','admin','manager']));
drop policy if exists "Customers read own reward transactions" on public.reward_transactions;
create policy "Customers read own reward transactions"
  on public.reward_transactions for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner','admin','manager']));

drop policy if exists "Customers read their referrals" on public.referrals;
create policy "Customers read their referrals"
  on public.referrals for select to authenticated
  using (
    referrer_profile_id = (select auth.uid())
    or referred_profile_id = (select auth.uid())
    or public.has_any_role(array['owner','admin','manager'])
  );

drop policy if exists "Customers read and create support tickets" on public.support_tickets;
create policy "Customers read and create support tickets"
  on public.support_tickets for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_any_role(array['owner','admin','manager']));
drop policy if exists "Customers create support tickets" on public.support_tickets;
create policy "Customers create support tickets"
  on public.support_tickets for insert to authenticated
  with check (profile_id = (select auth.uid()));
drop policy if exists "Admins update support tickets" on public.support_tickets;
create policy "Admins update support tickets"
  on public.support_tickets for update to authenticated
  using (public.has_any_role(array['owner','admin','manager']))
  with check (public.has_any_role(array['owner','admin','manager']));

grant select on public.booking_items, public.loyalty_settings, public.customer_rewards,
  public.reward_transactions, public.referrals, public.support_tickets to authenticated;
grant select, insert, update, delete on public.customer_cart_items to authenticated;
grant insert, update on public.support_tickets to authenticated;
grant update on public.loyalty_settings to authenticated;
revoke insert, update, delete on public.customer_rewards, public.reward_transactions, public.referrals from anon, authenticated;
revoke insert, delete on public.loyalty_settings from anon, authenticated;
revoke update, delete on public.support_tickets from anon, authenticated;
grant update on public.support_tickets to authenticated;

create or replace function public.initialize_customer_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_rewards(profile_id, referral_code)
  values (
    new.id,
    'ETOE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_customer_rewards_after_profile on public.profiles;
create trigger initialize_customer_rewards_after_profile
  after insert on public.profiles
  for each row execute function public.initialize_customer_rewards();

insert into public.customer_rewards(profile_id, referral_code)
select profile.id, 'ETOE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
from public.profiles profile
on conflict (profile_id) do nothing;

create or replace function public.claim_referral_internal(
  target_customer_id uuid,
  submitted_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_id uuid;
  referral_id uuid;
begin
  select rewards.profile_id into referrer_id
  from public.customer_rewards rewards
  join public.profiles profile on profile.id = rewards.profile_id
  where upper(rewards.referral_code) = upper(trim(submitted_code))
    and profile.role = 'customer'
    and profile.active;

  if referrer_id is null then raise exception 'Referral code is invalid'; end if;
  if referrer_id = target_customer_id then raise exception 'You cannot use your own referral code'; end if;
  if exists (select 1 from public.referrals where referred_profile_id = target_customer_id) then
    raise exception 'A referral code has already been used for this account';
  end if;

  insert into public.referrals(referrer_profile_id, referred_profile_id, referral_code)
  values (referrer_id, target_customer_id, upper(trim(submitted_code)))
  returning id into referral_id;
  return referral_id;
end;
$$;

create or replace function public.claim_referral(submitted_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return public.claim_referral_internal(auth.uid(), submitted_code);
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare submitted_code text;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;

  submitted_code := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
  if submitted_code is not null then
    perform public.claim_referral_internal(new.id, submitted_code);
  end if;
  return new;
end;
$$;

create or replace function public.update_membership_level(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare spend numeric(12,2);
  settings public.loyalty_settings;
begin
  select * into settings from public.loyalty_settings where singleton = true;
  select lifetime_spend into spend
  from public.customer_rewards where profile_id = target_profile_id;

  update public.customer_rewards
  set membership_level = case
        when settings.platinum_spend_threshold > 0 and spend >= settings.platinum_spend_threshold then 'Platinum'
        when settings.gold_spend_threshold > 0 and spend >= settings.gold_spend_threshold then 'Gold'
        else 'Silver'
      end,
      updated_at = now()
  where profile_id = target_profile_id;
end;
$$;

create or replace function public.expire_customer_points(target_profile_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid := coalesce(target_profile_id, auth.uid());
  credit record;
  credits_before integer;
  credits_through integer;
  outstanding_debits integer;
  points_remaining integer;
  expired_total integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if customer_id <> auth.uid() and not public.has_any_role(array['owner','admin']) then
    raise exception 'Cannot expire another customer account';
  end if;
  perform 1 from public.customer_rewards where profile_id = customer_id for update;
  if not found then return 0; end if;

  for credit in
    select id, profile_id, points_delta, created_at
    from public.reward_transactions
    where profile_id = customer_id
      and points_delta > 0
      and expires_at is not null
      and expires_at <= now()
      and transaction_type <> 'expiry'
    order by created_at, id
  loop
    if exists (
      select 1 from public.reward_transactions
      where event_key = 'expiry:' || credit.id::text
    ) then
      continue;
    end if;

    select coalesce(sum(points_delta), 0)::integer into credits_before
    from public.reward_transactions
    where profile_id = customer_id
      and points_delta > 0
      and (created_at, id) < (credit.created_at, credit.id);
    select coalesce(sum(points_delta), 0)::integer into credits_through
    from public.reward_transactions
    where profile_id = customer_id
      and points_delta > 0
      and (created_at, id) <= (credit.created_at, credit.id);
    select coalesce(sum(-points_delta), 0)::integer into outstanding_debits
    from public.reward_transactions
    where profile_id = customer_id
      and points_delta < 0
      and transaction_type <> 'expiry';

    points_remaining :=
      greatest(0, credits_through - outstanding_debits)
      - greatest(0, credits_before - outstanding_debits);
    points_remaining := greatest(points_remaining, 0);

    insert into public.reward_transactions(
      profile_id, transaction_type, points_delta, reason, event_key
    ) values (
      customer_id, 'expiry', -points_remaining,
      'Expired reward points', 'expiry:' || credit.id::text
    );
    if points_remaining > 0 then
      update public.customer_rewards
      set points_balance = greatest(points_balance - points_remaining, 0),
          updated_at = now()
      where profile_id = customer_id;
      expired_total := expired_total + points_remaining;
    end if;
  end loop;
  return expired_total;
end;
$$;

create or replace function public.get_expiring_reward_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare expiring_points integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  with credits as (
    select transaction.id,
      transaction.points_delta,
      transaction.expires_at,
      sum(transaction.points_delta) over (order by transaction.created_at, transaction.id) as credits_through,
      coalesce(sum(transaction.points_delta) over (
        order by transaction.created_at, transaction.id
        rows between unbounded preceding and 1 preceding
      ), 0) as credits_before
    from public.reward_transactions transaction
    where transaction.profile_id = auth.uid()
      and transaction.points_delta > 0
  ), debits as (
    select coalesce(sum(-transaction.points_delta), 0) as spent
    from public.reward_transactions transaction
    where transaction.profile_id = auth.uid()
      and transaction.points_delta < 0
      and transaction.transaction_type <> 'expiry'
  )
  select coalesce(sum(
    greatest(0, credits.credits_through - debits.spent)
    - greatest(0, credits.credits_before - debits.spent)
  ), 0)::integer into expiring_points
  from credits cross join debits
  where credits.expires_at > now()
    and credits.expires_at <= now() + interval '30 days';
  return expiring_points;
end;
$$;

create or replace function public.award_completed_booking_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.loyalty_settings;
  points_to_award integer;
  first_booking_points integer;
  referral public.referrals;
  inserted_transaction uuid;
begin
  if new.status <> 'Service Completed'
    or old.status = 'Service Completed'
    or new.customer_id is null
    or new.rewards_processed_at is not null then
    return new;
  end if;

  update public.bookings
  set rewards_processed_at = now()
  where id = new.id and rewards_processed_at is null;
  if not found then return new; end if;

  select * into settings from public.loyalty_settings where singleton = true;
  if not coalesce(settings.active, false) then return new; end if;

  points_to_award := floor(new.amount / 100 * settings.points_per_100)::integer;
  first_booking_points := case when not exists (
    select 1 from public.reward_transactions
    where profile_id = new.customer_id and transaction_type = 'first_booking_bonus'
  ) then settings.first_booking_bonus else 0 end;

  update public.customer_rewards
  set lifetime_spend = lifetime_spend + new.amount,
      updated_at = now()
  where profile_id = new.customer_id;

  if points_to_award > 0 then
    insert into public.reward_transactions(
      profile_id, booking_id, transaction_type, points_delta, reason, event_key, expires_at
    ) values (
      new.customer_id, new.id, 'booking_earned', points_to_award,
      'Points earned for completed booking ' || new.booking_ref,
      'booking-earned:' || new.id::text,
      case when settings.point_expiry_days > 0 then now() + make_interval(days => settings.point_expiry_days) else null end
    ) on conflict (event_key) do nothing
    returning id into inserted_transaction;

    if inserted_transaction is not null then
      update public.customer_rewards
      set points_balance = points_balance + points_to_award,
          total_points_earned = total_points_earned + points_to_award,
          updated_at = now()
      where profile_id = new.customer_id;
    end if;
  end if;

  if first_booking_points > 0 then
    inserted_transaction := null;
    insert into public.reward_transactions(
      profile_id, booking_id, transaction_type, points_delta, reason, event_key, expires_at
    ) values (
      new.customer_id, new.id, 'first_booking_bonus', first_booking_points,
      'First completed booking bonus',
      'first-booking-bonus:' || new.customer_id::text,
      case when settings.point_expiry_days > 0 then now() + make_interval(days => settings.point_expiry_days) else null end
    )
    on conflict (event_key) do nothing
    returning id into inserted_transaction;

    if inserted_transaction is not null then
      update public.customer_rewards
      set points_balance = points_balance + first_booking_points,
          total_points_earned = total_points_earned + first_booking_points,
          updated_at = now()
      where profile_id = new.customer_id;
    end if;
  end if;

  perform public.update_membership_level(new.customer_id);

  update public.referrals
  set status = 'qualified',
      qualifying_booking_id = new.id,
      qualified_at = now()
  where referred_profile_id = new.customer_id
    and status = 'pending'
  returning * into referral;

  if referral.id is not null then
    if settings.referral_referrer_bonus > 0 then
      insert into public.reward_transactions(
        profile_id, booking_id, transaction_type, points_delta, reason, event_key, expires_at
      ) values (
        referral.referrer_profile_id, new.id, 'referral_bonus',
        settings.referral_referrer_bonus, 'Referral qualified after completed booking',
        'referral-referrer:' || referral.id::text,
        case when settings.point_expiry_days > 0 then now() + make_interval(days => settings.point_expiry_days) else null end
      )
      on conflict (event_key) do nothing
      returning id into inserted_transaction;

      if inserted_transaction is not null then
        update public.customer_rewards
        set points_balance = points_balance + settings.referral_referrer_bonus,
            total_points_earned = total_points_earned + settings.referral_referrer_bonus,
            updated_at = now()
        where profile_id = referral.referrer_profile_id;
      end if;
    end if;

    if settings.referral_customer_bonus > 0 then
      insert into public.reward_transactions(
        profile_id, booking_id, transaction_type, points_delta, reason, event_key, expires_at
      ) values (
        new.customer_id, new.id, 'referral_bonus',
        settings.referral_customer_bonus, 'Welcome referral bonus after completed booking',
        'referral-customer:' || referral.id::text,
        case when settings.point_expiry_days > 0 then now() + make_interval(days => settings.point_expiry_days) else null end
      )
      on conflict (event_key) do nothing
      returning id into inserted_transaction;

      if inserted_transaction is not null then
        update public.customer_rewards
        set points_balance = points_balance + settings.referral_customer_bonus,
            total_points_earned = total_points_earned + settings.referral_customer_bonus,
            updated_at = now()
        where profile_id = new.customer_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists award_completed_booking_rewards_trigger on public.bookings;
create trigger award_completed_booking_rewards_trigger
  after update of status on public.bookings
  for each row execute function public.award_completed_booking_rewards();

create or replace function public.admin_adjust_reward_points(
  target_profile_id uuid,
  point_delta integer,
  adjustment_reason text
)
returns public.customer_rewards
language plpgsql
security definer
set search_path = ''
as $$
declare updated_account public.customer_rewards;
begin
  if not public.has_any_role(array['owner','admin']) then raise exception 'Admin access required'; end if;
  if point_delta = 0 or length(trim(adjustment_reason)) < 5 then
    raise exception 'A non-zero adjustment and a reason of at least five characters are required';
  end if;

  update public.customer_rewards
  set points_balance = points_balance + point_delta,
      total_points_earned = total_points_earned + greatest(point_delta, 0),
      total_points_redeemed = total_points_redeemed + greatest(-point_delta, 0),
      updated_at = now()
  where profile_id = target_profile_id
    and points_balance + point_delta >= 0
  returning * into updated_account;

  if updated_account.profile_id is null then raise exception 'Customer not found or balance would become negative'; end if;

  insert into public.reward_transactions(
    profile_id, transaction_type, points_delta, reason, event_key, actor_id
  ) values (
    target_profile_id, 'manual_adjustment', point_delta, trim(adjustment_reason),
    'manual-adjustment:' || gen_random_uuid()::text, auth.uid()
  );
  return updated_account;
end;
$$;

create or replace function public.create_customer_booking_with_items(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_scheduled_date date,
  p_time_slot text,
  p_address text,
  p_instructions text default '',
  p_coupon_code text default null,
  p_reward_points integer default 0
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings;
  cart_item jsonb;
  validated_items jsonb := '[]'::jsonb;
  service_id text;
  item_quantity integer;
  item_price numeric(12,2);
  first_service_id text;
  subtotal numeric(12,2) := 0;
  eligible_subtotal numeric(12,2) := 0;
  coupon_discount numeric(12,2) := 0;
  reward_discount numeric(12,2) := 0;
  final_amount numeric(12,2) := 0;
  settings public.loyalty_settings;
  account public.customer_rewards;
  coupon public.offers;
  transaction_id uuid;
  target_profile record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer' and active
  ) then raise exception 'An active customer account is required'; end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2
    or length(trim(coalesce(p_customer_phone, ''))) < 8
    or length(trim(coalesce(p_address, ''))) < 5
    or length(trim(coalesce(p_time_slot, ''))) < 3 then
    raise exception 'Valid customer name, phone, address, and time slot are required';
  end if;
  if p_scheduled_date < current_date then raise exception 'Scheduled date cannot be in the past'; end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one service to your cart';
  end if;
  if p_reward_points < 0 then raise exception 'Reward points cannot be negative'; end if;

  for cart_item in select value from jsonb_array_elements(p_items)
  loop
    service_id := trim(coalesce(cart_item ->> 'service_id', ''));
    item_quantity := coalesce((cart_item ->> 'quantity')::integer, 0);
    if item_quantity < 1 or item_quantity > 20 then raise exception 'Service quantity is invalid'; end if;

    select service.price into item_price
    from public.services service
    where service.id = service_id and service.active;
    if not found then raise exception 'A service in the cart is unavailable'; end if;

    if first_service_id is null then first_service_id := service_id; end if;
    subtotal := subtotal + item_price * item_quantity;
    validated_items := validated_items || jsonb_build_array(jsonb_build_object(
      'service_id', service_id,
      'quantity', item_quantity,
      'unit_price', item_price
    ));
  end loop;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into coupon
    from public.offers offer
    where upper(offer.coupon_code) = upper(trim(p_coupon_code))
      and offer.active
      and offer.starts_at <= now()
      and offer.expires_at > now()
    for update;
    if not found then raise exception 'Coupon is invalid, inactive, or expired'; end if;
  else
    select offer.* into coupon
    from public.offers offer
    where offer.coupon_code is null
      and offer.active
      and offer.starts_at <= now()
      and offer.expires_at > now()
      and exists (
        select 1
        from jsonb_array_elements(validated_items) item
        join public.offer_services offer_service
          on offer_service.service_id = item ->> 'service_id'
        where offer_service.offer_id = offer.id
      )
    order by offer.priority desc, offer.created_at desc
    limit 1
    for update;
  end if;

  if coupon.id is not null then
    if length(trim(coalesce(p_coupon_code, ''))) > 0 and coupon.max_redemptions is not null
      and coupon.redemption_count >= coupon.max_redemptions then
      raise exception 'Coupon redemption limit has been reached';
    end if;

    select coalesce(sum((item ->> 'unit_price')::numeric * (item ->> 'quantity')::integer), 0)
    into eligible_subtotal
    from jsonb_array_elements(validated_items) item
    where exists (
      select 1 from public.offer_services offer_service
      where offer_service.offer_id = coupon.id
        and offer_service.service_id = item ->> 'service_id'
    );
    if eligible_subtotal < coupon.min_booking_amount then
      if length(trim(coalesce(p_coupon_code, ''))) > 0 then
        raise exception 'Booking does not meet the coupon minimum amount';
      end if;
      coupon.id := null;
    end if;

    if coupon.id is not null then
      if eligible_subtotal = 0 then raise exception 'Coupon does not apply to the selected services'; end if;
      coupon_discount := least(
        eligible_subtotal,
        case when coupon.discount_type = 'fixed'
          then coupon.discount_value
          else round(eligible_subtotal * coupon.discount_value / 100, 2)
        end
      );
      if length(trim(coalesce(p_coupon_code, ''))) > 0 then
        update public.offers set redemption_count = redemption_count + 1 where id = coupon.id;
      end if;
    end if;
  end if;

  final_amount := greatest(subtotal - coupon_discount, 0);
  if p_reward_points > 0 then
    select * into settings from public.loyalty_settings where singleton = true;
    if not coalesce(settings.active, false) or settings.point_value <= 0 then
      raise exception 'Points redemption is not currently enabled';
    end if;
    perform public.expire_customer_points(auth.uid());
    select * into account from public.customer_rewards where profile_id = auth.uid() for update;
    if not found or p_reward_points > account.points_balance then
      raise exception 'Insufficient reward points';
    end if;
    reward_discount := least(final_amount, p_reward_points * settings.point_value);
    final_amount := greatest(final_amount - reward_discount, 0);
  end if;

  insert into public.bookings (
    customer_id, customer_name, customer_phone, service_id, scheduled_date,
    time_slot, address, instructions, amount, amount_before_discounts,
    coupon_code, coupon_discount, reward_discount, reward_points_redeemed,
    status, payment_status, admin_status, acceptance_status
  ) values (
    auth.uid(), trim(p_customer_name), trim(p_customer_phone), first_service_id,
    p_scheduled_date, trim(p_time_slot), trim(p_address), coalesce(trim(p_instructions), ''),
    final_amount, subtotal, nullif(upper(trim(coalesce(p_coupon_code, ''))), ''),
    coupon_discount, reward_discount, p_reward_points,
    'Booking Confirmed', 'Pending', 'Pending Admin Confirmation', 'Not Assigned'
  ) returning * into booking;

  for cart_item in select value from jsonb_array_elements(validated_items)
  loop
    insert into public.booking_items(booking_id, service_id, quantity, unit_price, line_total)
    values (
      booking.id,
      cart_item ->> 'service_id',
      (cart_item ->> 'quantity')::integer,
      (cart_item ->> 'unit_price')::numeric,
      (cart_item ->> 'unit_price')::numeric * (cart_item ->> 'quantity')::integer
    );
  end loop;

  if p_reward_points > 0 then
    insert into public.reward_transactions(
      profile_id, booking_id, transaction_type, points_delta, reason, event_key
    ) values (
      auth.uid(), booking.id, 'redemption', -p_reward_points,
      'Points redeemed on booking ' || booking.booking_ref,
      'booking-redeemed:' || booking.id::text
    ) returning id into transaction_id;

    update public.customer_rewards
    set points_balance = points_balance - p_reward_points,
        total_points_redeemed = total_points_redeemed + p_reward_points,
        updated_at = now()
    where profile_id = auth.uid()
      and points_balance >= p_reward_points;
    if not found then raise exception 'Insufficient reward points'; end if;
  end if;

  insert into public.booking_status_history(booking_id, status, note, updated_by)
  values (booking.id, 'Booking Confirmed', 'Customer created booking', auth.uid());
  insert into public.booking_audit_log(booking_id, action, next_status, actor_id, metadata)
  values (
    booking.id, 'Customer Booking Created', 'Booking Confirmed', auth.uid(),
    jsonb_build_object('booking_ref', booking.booking_ref, 'items', validated_items,
      'coupon_code', booking.coupon_code, 'reward_points_redeemed', p_reward_points)
  );

  for target_profile in
    select id from public.profiles where role in ('owner','admin') and active
  loop
    perform public.insert_order_notification(
      target_profile.id, 'new_booking', 'New booking received',
      format('%s · %s · %s service item(s)', booking.booking_ref, p_customer_name, jsonb_array_length(validated_items)),
      '#tracking/' || booking.id::text,
      jsonb_build_object(
        'booking_id', booking.id, 'booking_ref', booking.booking_ref,
        'customer_name', p_customer_name, 'scheduled_date', p_scheduled_date,
        'time_slot', p_time_slot, 'address', p_address, 'amount', final_amount,
        'payment_status', 'Pending'
      ),
      'new_booking:' || booking.id::text
    );
  end loop;

  return booking;
end;
$$;

revoke all on function public.initialize_customer_rewards() from public;
revoke all on function public.set_review_service_id() from public;
revoke all on function public.claim_referral_internal(uuid,text) from public;
revoke all on function public.update_membership_level(uuid) from public;
revoke all on function public.award_completed_booking_rewards() from public;
revoke all on function public.expire_customer_points(uuid) from public;
revoke all on function public.get_expiring_reward_points() from public;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.admin_adjust_reward_points(uuid,integer,text) to authenticated;
grant execute on function public.expire_customer_points(uuid) to authenticated;
grant execute on function public.get_expiring_reward_points() to authenticated;
grant execute on function public.create_customer_booking_with_items(jsonb,text,text,date,text,text,text,text,integer) to authenticated;
