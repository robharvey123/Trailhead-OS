create extension if not exists "pgcrypto";

create type workspace_role as enum ('owner', 'admin', 'editor', 'viewer');

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  brand_filter text not null default 'RUSH',
  cogs_pct numeric(5,4) not null default 0.55,
  promo_cost numeric(12,4) not null default 0.55,
  currency_symbol text not null default '$'
);

create table if not exists customer_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sell_in_customer text not null,
  sell_out_company text not null,
  group_name text,
  created_at timestamptz not null default now()
);

create table if not exists sell_in (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  customer text not null,
  country text,
  brand text not null,
  product text not null,
  date date not null,
  qty_cans integer not null,
  unit_price numeric(12,4),
  total numeric(14,4),
  promo_cans integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sell_out (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company text not null,
  brand text not null,
  product text not null,
  month date not null,
  units integer not null,
  platform text,
  region text,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_user_id_idx on workspaces(owner_user_id);

create index if not exists workspace_members_user_id_idx on workspace_members(user_id);

create index if not exists customer_mappings_workspace_id_idx on customer_mappings(workspace_id);
create index if not exists customer_mappings_workspace_customer_idx on customer_mappings(workspace_id, sell_in_customer);
create index if not exists customer_mappings_workspace_company_idx on customer_mappings(workspace_id, sell_out_company);

create index if not exists sell_in_workspace_id_idx on sell_in(workspace_id);
create index if not exists sell_in_workspace_brand_idx on sell_in(workspace_id, brand);
create index if not exists sell_in_workspace_date_idx on sell_in(workspace_id, date);
create index if not exists sell_in_workspace_customer_idx on sell_in(workspace_id, customer);
create index if not exists sell_in_workspace_product_idx on sell_in(workspace_id, product);

create index if not exists sell_out_workspace_id_idx on sell_out(workspace_id);
create index if not exists sell_out_workspace_brand_idx on sell_out(workspace_id, brand);
create index if not exists sell_out_workspace_month_idx on sell_out(workspace_id, month);
create index if not exists sell_out_workspace_company_idx on sell_out(workspace_id, company);
create index if not exists sell_out_workspace_product_idx on sell_out(workspace_id, product);

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_settings enable row level security;
alter table customer_mappings enable row level security;
alter table sell_in enable row level security;
alter table sell_out enable row level security;

create policy workspaces_select on workspaces
  for select
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

create policy workspaces_insert on workspaces
  for insert
  with check (owner_user_id = auth.uid());

create policy workspaces_update on workspaces
  for update
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    owner_user_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspaces_delete on workspaces
  for delete
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_members_select on workspace_members
  for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy workspace_members_insert on workspace_members
  for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_members_update on workspace_members
  for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_members_delete on workspace_members
  for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_settings_select on workspace_settings
  for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy workspace_settings_insert on workspace_settings
  for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy workspace_settings_update on workspace_settings
  for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy workspace_settings_delete on workspace_settings
  for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy customer_mappings_select on customer_mappings
  for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = customer_mappings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy customer_mappings_insert on customer_mappings
  for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = customer_mappings.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy customer_mappings_update on customer_mappings
  for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = customer_mappings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = customer_mappings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy customer_mappings_delete on customer_mappings
  for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = customer_mappings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy sell_in_select on sell_in
  for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_in.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy sell_in_insert on sell_in
  for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_in.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy sell_in_update on sell_in
  for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_in.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_in.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy sell_in_delete on sell_in
  for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_in.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy sell_out_select on sell_out
  for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_out.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy sell_out_insert on sell_out
  for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_out.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy sell_out_update on sell_out
  for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_out.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_out.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );

create policy sell_out_delete on sell_out
  for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = sell_out.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'editor')
    )
  );
