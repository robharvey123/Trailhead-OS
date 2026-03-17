-- ============================================================
-- Brand Opps Platform Expansion Migration
-- Adds: CRM, Marketing, Finance, Products, Supply Chain,
--        Staffing, Communications modules
-- ============================================================

-- ============================================================
-- 1. CRM MODULE
-- ============================================================

create table if not exists crm_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'customer' check (type in ('customer', 'prospect', 'partner', 'vendor', 'distributor', 'retailer')),
  industry text,
  website text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text,
  department text,
  is_primary boolean not null default false,
  notes text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  title text not null,
  value numeric(12,2),
  currency text not null default 'USD',
  stage text not null default 'lead' check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability integer default 0 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  actual_close_date date,
  notes text,
  tags text[] not null default '{}',
  owner_user_id uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references crm_accounts(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  deal_id uuid references crm_deals(id) on delete set null,
  type text not null check (type in ('call', 'email', 'meeting', 'note', 'task')),
  subject text not null,
  body text,
  activity_date timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- CRM indexes
create index if not exists idx_crm_accounts_ws on crm_accounts(workspace_id);
create index if not exists idx_crm_contacts_ws on crm_contacts(workspace_id);
create index if not exists idx_crm_contacts_account on crm_contacts(account_id);
create index if not exists idx_crm_deals_ws on crm_deals(workspace_id);
create index if not exists idx_crm_deals_account on crm_deals(account_id);
create index if not exists idx_crm_deals_stage on crm_deals(workspace_id, stage);
create index if not exists idx_crm_activities_ws on crm_activities(workspace_id);
create index if not exists idx_crm_activities_account on crm_activities(account_id);
create index if not exists idx_crm_activities_contact on crm_activities(contact_id);

-- ============================================================
-- 2. MARKETING MODULE
-- ============================================================

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'promotion' check (type in ('promotion', 'launch', 'awareness', 'retention', 'event', 'seasonal', 'other')),
  status text not null default 'draft' check (status in ('draft', 'planned', 'active', 'paused', 'completed', 'cancelled')),
  channel text check (channel in ('social', 'email', 'paid_search', 'display', 'retail', 'pr', 'influencer', 'multi_channel')),
  budget_allocated numeric(12,2) default 0,
  budget_spent numeric(12,2) default 0,
  start_date date,
  end_date date,
  target_audience text,
  goals text,
  kpi_target jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  owner_user_id uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists marketing_content (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  title text not null,
  content_type text not null default 'post' check (content_type in ('post', 'story', 'reel', 'blog', 'email', 'ad', 'press_release', 'landing_page', 'other')),
  channel text check (channel in ('instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube', 'email', 'website', 'other')),
  body text,
  scheduled_date date,
  scheduled_time time,
  status text not null default 'idea' check (status in ('idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'archived')),
  tags text[] not null default '{}',
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists marketing_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  content_id uuid references marketing_content(id) on delete set null,
  name text not null,
  file_type text not null check (file_type in ('image', 'video', 'document', 'audio', 'other')),
  file_url text not null,
  file_size_bytes bigint,
  mime_type text,
  alt_text text,
  tags text[] not null default '{}',
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Marketing indexes
create index if not exists idx_mktg_campaigns_ws on marketing_campaigns(workspace_id);
create index if not exists idx_mktg_campaigns_status on marketing_campaigns(workspace_id, status);
create index if not exists idx_mktg_content_ws on marketing_content(workspace_id);
create index if not exists idx_mktg_content_campaign on marketing_content(campaign_id);
create index if not exists idx_mktg_content_date on marketing_content(workspace_id, scheduled_date);
create index if not exists idx_mktg_assets_ws on marketing_assets(workspace_id);
create index if not exists idx_mktg_assets_campaign on marketing_assets(campaign_id);

-- ============================================================
-- 3. FINANCE MODULE
-- ============================================================

create table if not exists finance_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_number text not null,
  account_id uuid references crm_accounts(id) on delete set null,
  contact_id uuid references crm_contacts(id) on delete set null,
  direction text not null default 'outgoing' check (direction in ('incoming', 'outgoing')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled', 'refunded')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  currency text not null default 'USD',
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  payment_terms text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, invoice_number)
);

create table if not exists finance_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  po_number text not null,
  vendor_account_id uuid references crm_accounts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'ordered', 'partial_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_delivery_date date,
  actual_delivery_date date,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'USD',
  line_items jsonb not null default '[]'::jsonb,
  shipping_address text,
  notes text,
  approved_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, po_number)
);

create table if not exists finance_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid references finance_invoices(id) on delete set null,
  purchase_order_id uuid references finance_purchase_orders(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  method text check (method in ('bank_transfer', 'credit_card', 'check', 'cash', 'paypal', 'stripe', 'other')),
  reference_number text,
  payment_date date not null default current_date,
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists finance_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  category text not null check (category in ('marketing', 'operations', 'staffing', 'product', 'logistics', 'general')),
  period_start date not null,
  period_end date not null,
  allocated numeric(12,2) not null default 0,
  spent numeric(12,2) not null default 0,
  currency text not null default 'USD',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Finance indexes
create index if not exists idx_fin_invoices_ws on finance_invoices(workspace_id);
create index if not exists idx_fin_invoices_status on finance_invoices(workspace_id, status);
create index if not exists idx_fin_invoices_account on finance_invoices(account_id);
create index if not exists idx_fin_po_ws on finance_purchase_orders(workspace_id);
create index if not exists idx_fin_po_status on finance_purchase_orders(workspace_id, status);
create index if not exists idx_fin_payments_ws on finance_payments(workspace_id);
create index if not exists idx_fin_payments_invoice on finance_payments(invoice_id);
create index if not exists idx_fin_budgets_ws on finance_budgets(workspace_id);

-- ============================================================
-- 4. PRODUCTS MODULE
-- ============================================================

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  sku text not null,
  brand text,
  category text,
  description text,
  unit_cost numeric(10,2),
  unit_price numeric(10,2),
  weight_grams numeric(10,2),
  status text not null default 'active' check (status in ('draft', 'active', 'discontinued', 'archived')),
  attributes jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  image_url text,
  barcode text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, sku)
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sku text not null,
  attributes jsonb not null default '{}'::jsonb,
  unit_cost numeric(10,2),
  unit_price numeric(10,2),
  status text not null default 'active' check (status in ('active', 'discontinued', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, sku)
);

create table if not exists product_launches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  title text not null,
  description text,
  launch_date date,
  status text not null default 'planning' check (status in ('planning', 'development', 'testing', 'ready', 'launched', 'cancelled')),
  checklist jsonb not null default '[]'::jsonb,
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Products indexes
create index if not exists idx_products_ws on products(workspace_id);
create index if not exists idx_products_status on products(workspace_id, status);
create index if not exists idx_product_variants_ws on product_variants(workspace_id);
create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_product_launches_ws on product_launches(workspace_id);

-- ============================================================
-- 5. SUPPLY CHAIN MODULE
-- ============================================================

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  warehouse text not null default 'main',
  qty_on_hand integer not null default 0,
  qty_reserved integer not null default 0,
  qty_available integer generated always as (qty_on_hand - qty_reserved) stored,
  reorder_point integer not null default 0,
  reorder_qty integer not null default 0,
  unit_cost numeric(10,2),
  last_counted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, product_id, variant_id, warehouse)
);

create table if not exists supply_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  order_number text not null,
  supplier_account_id uuid references crm_accounts(id) on delete set null,
  purchase_order_id uuid references finance_purchase_orders(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  actual_delivery_date date,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, order_number)
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  supply_order_id uuid references supply_orders(id) on delete set null,
  reference_number text,
  carrier text,
  tracking_number text,
  status text not null default 'pending' check (status in ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'lost')),
  ship_date date,
  estimated_delivery date,
  actual_delivery date,
  origin_address text,
  destination_address text,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Supply chain indexes
create index if not exists idx_inventory_ws on inventory(workspace_id);
create index if not exists idx_inventory_product on inventory(product_id);
create index if not exists idx_supply_orders_ws on supply_orders(workspace_id);
create index if not exists idx_supply_orders_status on supply_orders(workspace_id, status);
create index if not exists idx_shipments_ws on shipments(workspace_id);
create index if not exists idx_shipments_order on shipments(supply_order_id);

-- ============================================================
-- 6. STAFFING MODULE
-- ============================================================

create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  email text,
  phone text,
  department text check (department in ('sales', 'marketing', 'operations', 'finance', 'product', 'logistics', 'management', 'other')),
  role_title text,
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time', 'contractor', 'intern')),
  hourly_rate numeric(8,2),
  capacity_hours_per_week numeric(5,1) not null default 40,
  start_date date,
  tags text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, user_id)
);

create table if not exists staff_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  type text not null default 'work' check (type in ('work', 'meeting', 'break', 'leave', 'holiday', 'training')),
  title text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  task_id uuid references workspace_tasks(id) on delete set null,
  date date not null,
  hours numeric(5,2) not null check (hours > 0),
  description text,
  billable boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Staffing indexes
create index if not exists idx_staff_profiles_ws on staff_profiles(workspace_id);
create index if not exists idx_staff_profiles_user on staff_profiles(user_id);
create index if not exists idx_staff_schedules_ws on staff_schedules(workspace_id);
create index if not exists idx_staff_schedules_profile on staff_schedules(staff_profile_id);
create index if not exists idx_staff_schedules_date on staff_schedules(workspace_id, date);
create index if not exists idx_staff_time_ws on staff_time_entries(workspace_id);
create index if not exists idx_staff_time_profile on staff_time_entries(staff_profile_id);
create index if not exists idx_staff_time_date on staff_time_entries(workspace_id, date);

-- ============================================================
-- 7. COMMUNICATIONS MODULE
-- ============================================================

create table if not exists comm_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'general' check (type in ('general', 'project', 'announcement', 'direct')),
  is_archived boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists comm_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel_id uuid not null references comm_channels(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  parent_message_id uuid references comm_messages(id) on delete set null,
  body text not null,
  is_edited boolean not null default false,
  is_pinned boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('task_assigned', 'task_due', 'mention', 'message', 'invoice', 'deal_update', 'system', 'reminder')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

-- Communications indexes
create index if not exists idx_comm_channels_ws on comm_channels(workspace_id);
create index if not exists idx_comm_messages_ws on comm_messages(workspace_id);
create index if not exists idx_comm_messages_channel on comm_messages(channel_id);
create index if not exists idx_comm_messages_sender on comm_messages(sender_id);
create index if not exists idx_comm_messages_parent on comm_messages(parent_message_id);
create index if not exists idx_notifications_ws on notifications(workspace_id);
create index if not exists idx_notifications_user on notifications(user_id, is_read);

-- ============================================================
-- ENABLE RLS ON ALL NEW TABLES
-- ============================================================

alter table crm_accounts enable row level security;
alter table crm_contacts enable row level security;
alter table crm_deals enable row level security;
alter table crm_activities enable row level security;
alter table marketing_campaigns enable row level security;
alter table marketing_content enable row level security;
alter table marketing_assets enable row level security;
alter table finance_invoices enable row level security;
alter table finance_purchase_orders enable row level security;
alter table finance_payments enable row level security;
alter table finance_budgets enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_launches enable row level security;
alter table inventory enable row level security;
alter table supply_orders enable row level security;
alter table shipments enable row level security;
alter table staff_profiles enable row level security;
alter table staff_schedules enable row level security;
alter table staff_time_entries enable row level security;
alter table comm_channels enable row level security;
alter table comm_messages enable row level security;
alter table notifications enable row level security;

-- ============================================================
-- RLS POLICIES (workspace-scoped via workspace_members)
-- ============================================================

-- CRM
create policy crm_accounts_member on crm_accounts for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy crm_contacts_member on crm_contacts for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy crm_deals_member on crm_deals for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy crm_activities_member on crm_activities for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Marketing
create policy mktg_campaigns_member on marketing_campaigns for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy mktg_content_member on marketing_content for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy mktg_assets_member on marketing_assets for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Finance
create policy fin_invoices_member on finance_invoices for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy fin_po_member on finance_purchase_orders for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy fin_payments_member on finance_payments for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy fin_budgets_member on finance_budgets for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Products
create policy products_member on products for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy product_variants_member on product_variants for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy product_launches_member on product_launches for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Supply Chain
create policy inventory_member on inventory for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy supply_orders_member on supply_orders for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy shipments_member on shipments for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Staffing
create policy staff_profiles_member on staff_profiles for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy staff_schedules_member on staff_schedules for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy staff_time_entries_member on staff_time_entries for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Communications
create policy comm_channels_member on comm_channels for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy comm_messages_member on comm_messages for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy notifications_member on notifications for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- ============================================================
-- AUTO-UPDATE TRIGGERS (reuse existing function)
-- ============================================================

create trigger crm_accounts_updated_at before update on crm_accounts
  for each row execute function update_workspace_updated_at();

create trigger crm_contacts_updated_at before update on crm_contacts
  for each row execute function update_workspace_updated_at();

create trigger crm_deals_updated_at before update on crm_deals
  for each row execute function update_workspace_updated_at();

create trigger mktg_campaigns_updated_at before update on marketing_campaigns
  for each row execute function update_workspace_updated_at();

create trigger mktg_content_updated_at before update on marketing_content
  for each row execute function update_workspace_updated_at();

create trigger fin_invoices_updated_at before update on finance_invoices
  for each row execute function update_workspace_updated_at();

create trigger fin_po_updated_at before update on finance_purchase_orders
  for each row execute function update_workspace_updated_at();

create trigger fin_budgets_updated_at before update on finance_budgets
  for each row execute function update_workspace_updated_at();

create trigger products_updated_at before update on products
  for each row execute function update_workspace_updated_at();

create trigger product_variants_updated_at before update on product_variants
  for each row execute function update_workspace_updated_at();

create trigger product_launches_updated_at before update on product_launches
  for each row execute function update_workspace_updated_at();

create trigger inventory_updated_at before update on inventory
  for each row execute function update_workspace_updated_at();

create trigger supply_orders_updated_at before update on supply_orders
  for each row execute function update_workspace_updated_at();

create trigger shipments_updated_at before update on shipments
  for each row execute function update_workspace_updated_at();

create trigger staff_profiles_updated_at before update on staff_profiles
  for each row execute function update_workspace_updated_at();

create trigger staff_schedules_updated_at before update on staff_schedules
  for each row execute function update_workspace_updated_at();

create trigger staff_time_entries_updated_at before update on staff_time_entries
  for each row execute function update_workspace_updated_at();

create trigger comm_channels_updated_at before update on comm_channels
  for each row execute function update_workspace_updated_at();

create trigger comm_messages_updated_at before update on comm_messages
  for each row execute function update_workspace_updated_at();
