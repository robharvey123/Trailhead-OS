-- ============================================================
-- Platform Overhaul Migration
-- Finance: credit notes, expense claims, recurring invoices, PO→Invoice, deal→invoice
-- Supply Chain: inventory movements
-- Marketing: campaign results, budget linking
-- CRM: contact→deal cross-ref
-- ============================================================

-- 1. Credit Notes
create table if not exists finance_credit_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  credit_note_number text not null,
  invoice_id uuid references finance_invoices(id) on delete set null,
  account_id uuid references crm_accounts(id) on delete set null,
  direction text not null default 'outgoing' check (direction in ('incoming','outgoing')),
  status text not null default 'draft' check (status in ('draft','issued','applied','void')),
  issue_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  reason text,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_credit_notes_ws on finance_credit_notes(workspace_id);
create index if not exists idx_credit_notes_invoice on finance_credit_notes(invoice_id);

alter table finance_credit_notes enable row level security;
create policy "ws members credit_notes" on finance_credit_notes
  for all using (exists (
    select 1 from workspace_members wm where wm.workspace_id = finance_credit_notes.workspace_id and wm.user_id = auth.uid()
  ));

-- 2. Expense Claims
create table if not exists finance_expense_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'general' check (category in ('travel','meals','office','software','marketing','operations','general','other')),
  amount numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  expense_date date not null default current_date,
  receipt_url text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','paid')),
  approver_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_claims_ws on finance_expense_claims(workspace_id);
create index if not exists idx_expense_claims_user on finance_expense_claims(claimant_user_id);

alter table finance_expense_claims enable row level security;
create policy "ws members expense_claims" on finance_expense_claims
  for all using (exists (
    select 1 from workspace_members wm where wm.workspace_id = finance_expense_claims.workspace_id and wm.user_id = auth.uid()
  ));

-- 3. Recurring invoice support on finance_invoices
alter table finance_invoices add column if not exists recurrence_cadence text check (recurrence_cadence in ('weekly','monthly','quarterly','yearly'));
alter table finance_invoices add column if not exists recurrence_interval integer default 1;
alter table finance_invoices add column if not exists next_recurrence_date date;
alter table finance_invoices add column if not exists recurrence_parent_id uuid references finance_invoices(id) on delete set null;

-- 4. PO → Invoice linking
alter table finance_invoices add column if not exists purchase_order_id uuid references finance_purchase_orders(id) on delete set null;

-- 5. Deal → Invoice linking
alter table finance_invoices add column if not exists deal_id uuid references crm_deals(id) on delete set null;

-- 6. Inventory Movements
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  warehouse text not null,
  direction text not null check (direction in ('in','out')),
  quantity integer not null,
  reference_type text check (reference_type in ('purchase_order','supply_order','shipment','adjustment','return')),
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_movements_ws on inventory_movements(workspace_id);
create index if not exists idx_inv_movements_product on inventory_movements(product_id);

alter table inventory_movements enable row level security;
create policy "ws members inv_movements" on inventory_movements
  for all using (exists (
    select 1 from workspace_members wm where wm.workspace_id = inventory_movements.workspace_id and wm.user_id = auth.uid()
  ));

-- 7. Campaign performance results + budget linking
alter table marketing_campaigns add column if not exists results jsonb not null default '{}'::jsonb;
alter table marketing_campaigns add column if not exists budget_id uuid references finance_budgets(id) on delete set null;

-- 8. Workspace audit/activity log (cross-module)
create table if not exists workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_ws on workspace_audit_log(workspace_id);
create index if not exists idx_audit_log_entity on workspace_audit_log(entity_type, entity_id);

alter table workspace_audit_log enable row level security;
create policy "ws members audit_log" on workspace_audit_log
  for all using (exists (
    select 1 from workspace_members wm where wm.workspace_id = workspace_audit_log.workspace_id and wm.user_id = auth.uid()
  ));
