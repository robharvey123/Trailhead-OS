create table pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  hourly_rate numeric not null default 0,
  day_rate numeric not null default 0,
  monthly_retainer numeric not null default 0,
  hosting_maintenance numeric not null default 0,
  fixed_fee_margin numeric not null default 0,
  sort_order int default 0,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table pricing_tiers enable row level security;
create policy "authenticated full access" on pricing_tiers
  for all using (auth.role() = 'authenticated');

insert into pricing_tiers
  (name, slug, description, hourly_rate, day_rate,
   monthly_retainer, hosting_maintenance, fixed_fee_margin,
   sort_order, is_default)
values
(
  'Mates rates', 'mates',
  'For friends and close contacts. Cost plus a small margin.',
  35, 250, 400, 50, 15, 1, false
),
(
  'Budget', 'budget',
  'Competitive rate for startups and small businesses.',
  55, 400, 650, 80, 25, 2, true
),
(
  'Standard', 'standard',
  'Full commercial rate for established businesses.',
  80, 600, 950, 120, 35, 3, false
);

alter table quotes
  add column if not exists pricing_tier_id uuid
  references pricing_tiers(id) on delete set null;

alter table invoices
  add column if not exists pricing_tier_id uuid
  references pricing_tiers(id) on delete set null;
