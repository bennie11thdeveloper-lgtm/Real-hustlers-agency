create extension if not exists pgcrypto;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+256[0-9]{9}$'),
  email text not null,
  role text not null check (
    role in ('Domestic workers', 'Drivers', 'Security workers', 'Machine operators', 'Other')
  ),
  experience text not null default '' check (char_length(experience) <= 2000),
  status text not null default 'submitted' check (
    status in ('submitted', 'under_review', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create table public.application_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  tx_ref text not null unique,
  provider_transaction_id text unique,
  amount integer not null check (amount = 150000),
  currency text not null default 'UGX' check (currency = 'UGX'),
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'cancelled')
  ),
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  file_key text not null unique,
  file_name text not null,
  content_type text not null,
  file_size bigint not null check (file_size between 1 and 4194304),
  created_at timestamptz not null default now()
);

create index application_documents_application_id_idx
  on public.application_documents (application_id);

create function public.add_application_document(
  p_application_id uuid,
  p_file_key text,
  p_file_name text,
  p_content_type text,
  p_file_size bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if (select count(*) from public.application_documents where application_id = p_application_id) >= 5 then
    raise exception 'Application document limit reached';
  end if;

  insert into public.application_documents (
    application_id,
    file_key,
    file_name,
    content_type,
    file_size
  ) values (
    p_application_id,
    p_file_key,
    p_file_name,
    p_content_type,
    p_file_size
  );
end;
$$;

alter table public.applications enable row level security;
alter table public.application_payments enable row level security;
alter table public.application_documents enable row level security;

revoke all on public.applications from anon, authenticated;
revoke all on public.application_payments from anon, authenticated;
revoke all on public.application_documents from anon, authenticated;
revoke all on function public.add_application_document(uuid, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.add_application_document(uuid, text, text, text, bigint) to service_role;
