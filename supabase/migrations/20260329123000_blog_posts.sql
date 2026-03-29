create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  body text not null,
  published boolean default false,
  published_at timestamptz,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table blog_posts enable row level security;

create policy "public can read published posts" on blog_posts
  for select using (published = true);

create policy "authenticated full access" on blog_posts
  for all using (auth.role() = 'authenticated');

insert into blog_posts (slug, title, excerpt, body, published, published_at, tags)
values
(
  'building-trailhead',
  'Building a business operating system from scratch',
  'How I replaced five different tools with one custom-built platform for managing all my workstreams.',
  '## The problem with off-the-shelf tools\n\nRunning multiple business workstreams simultaneously means juggling...\n\n*Full post coming soon.*',
  true,
  now(),
  array['tech', 'business']
),
(
  'ngp-market-opportunity-2026',
  'The NGP market opportunity in 2026',
  'Nicotine pouches have moved from niche to mainstream. Here is what the data says about where the market is heading.',
  '## Where we are\n\nThe UK nicotine pouch market has grown significantly...\n\n*Full post coming soon.*',
  true,
  now(),
  array['ngp', 'consulting']
);
