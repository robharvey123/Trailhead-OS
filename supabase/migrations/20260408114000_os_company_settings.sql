create table if not exists os_company_settings (
  key text primary key default 'default' check (key = 'default'),
  company_name text not null default 'Trailhead Holdings Ltd',
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text not null default 'United Kingdom',
  company_email text,
  company_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into os_company_settings (
  key,
  company_name,
  city,
  country,
  company_email,
  company_number
) values (
  'default',
  'Trailhead Holdings Ltd',
  'Brentwood, Essex',
  'United Kingdom',
  'info@trailheadholdings.uk',
  '16910286'
)
on conflict (key) do nothing;

alter table os_company_settings enable row level security;

create policy "authenticated full access os_company_settings"
  on os_company_settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');