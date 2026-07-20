-- Serverless-safe throttling for the public (unauthenticated) forms. The public
-- enquiry/contact endpoints run as the anon role, which has no SELECT on
-- enquiries, so the hourly rate-limit count can't be a plain select. These
-- SECURITY DEFINER helpers return only an integer count (never row data) and are
-- the only read path granted to anon.

-- Count enquiries created in the last hour (throttle for the discovery form).
create or replace function public.count_recent_enquiries()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from enquiries
  where created_at > now() - interval '1 hour';
$$;

revoke all on function public.count_recent_enquiries() from public;
grant execute on function public.count_recent_enquiries() to anon, authenticated;

-- The marketing contact form doesn't persist anything, so it has nothing to
-- count against. This tiny append-only table records one row per accepted
-- submission purely for hourly throttling — no PII, just a bucket + timestamp.
create table if not exists public_form_events (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_form_events_bucket_created_at
  on public_form_events (bucket, created_at desc);

alter table public_form_events enable row level security;

-- Anon may append events (with check true), but never read them back.
drop policy if exists "public can insert form events" on public_form_events;
create policy "public can insert form events" on public_form_events
  for insert
  with check (true);

create or replace function public.count_recent_public_form_events(p_bucket text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public_form_events
  where bucket = p_bucket
    and created_at > now() - interval '1 hour';
$$;

revoke all on function public.count_recent_public_form_events(text) from public;
grant execute on function public.count_recent_public_form_events(text) to anon, authenticated;
