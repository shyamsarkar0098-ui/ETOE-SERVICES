create table if not exists public.chatbot_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  provider text not null default 'openai-compatible'
    check (provider in ('openai-compatible', 'anthropic')),
  api_url text not null default '',
  model text not null default '',
  api_key_ciphertext text,
  api_key_iv text,
  welcome_message text not null default E'Namaste! Welcome to ETOE Service 👋\n\nHow can I help you today?\n\nYou can book a service, explore our services, track your booking, check rewards, or contact support.',
  quick_replies jsonb not null default '["Book a Service","Explore Services","My Bookings","Track Booking","Rewards & Points","Offers & Coupons","Contact Support"]'::jsonb,
  faq_items jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.chatbot_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  anonymous_session_hash text,
  status text not null default 'open' check (status in ('open', 'human', 'closed')),
  subject text not null default 'Customer chat',
  last_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or anonymous_session_hash is not null)
);

create index if not exists chatbot_conversations_customer_updated_idx
  on public.chatbot_conversations(profile_id, updated_at desc);
create index if not exists chatbot_conversations_status_updated_idx
  on public.chatbot_conversations(status, updated_at desc);

create table if not exists public.chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chatbot_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'assistant', 'agent')),
  content text not null check (length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);

create index if not exists chatbot_messages_conversation_created_idx
  on public.chatbot_messages(conversation_id, created_at);

create table if not exists public.chatbot_rate_limits (
  key_hash text primary key,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.chatbot_settings enable row level security;
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.chatbot_rate_limits enable row level security;

revoke all on public.chatbot_settings, public.chatbot_conversations,
  public.chatbot_messages, public.chatbot_rate_limits from anon, authenticated;
grant all on public.chatbot_settings, public.chatbot_conversations,
  public.chatbot_messages, public.chatbot_rate_limits to service_role;

create or replace function public.consume_chatbot_rate_limit(
  p_key_hash text,
  p_bucket_start timestamptz,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if length(p_key_hash) <> 64 or p_max_requests < 1 then
    raise exception 'Invalid rate limit request';
  end if;

  insert into public.chatbot_rate_limits(key_hash, bucket_start, request_count)
  values (p_key_hash, p_bucket_start, 1)
  on conflict (key_hash) do update
  set bucket_start = excluded.bucket_start,
      request_count = case
        when public.chatbot_rate_limits.bucket_start = excluded.bucket_start
          then public.chatbot_rate_limits.request_count + 1
        else 1
      end,
      updated_at = now()
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_chatbot_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_chatbot_rate_limit(text, timestamptz, integer) to service_role;
