-- ========================================
-- Trailhead Holdings Hub
-- Income streams, commission, bank, expenses
-- ========================================

-- ========================================
-- income_streams
-- ========================================
CREATE TABLE income_streams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('saas', 'commission', 'consulting', 'product', 'other')),
  description   text,
  account_id    uuid REFERENCES crm_accounts(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  config        jsonb NOT NULL DEFAULT '{}',
  currency      text NOT NULL DEFAULT 'GBP',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_streams_workspace ON income_streams(workspace_id);
CREATE INDEX idx_income_streams_workspace_type ON income_streams(workspace_id, type);

ALTER TABLE income_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_streams_select"
  ON income_streams FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "income_streams_insert"
  ON income_streams FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "income_streams_update"
  ON income_streams FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "income_streams_delete"
  ON income_streams FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- workspace_links
-- ========================================
CREATE TABLE workspace_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linked_workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, linked_workspace_id),
  CHECK (workspace_id <> linked_workspace_id)
);

CREATE INDEX idx_workspace_links_workspace ON workspace_links(workspace_id);

ALTER TABLE workspace_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_links_select"
  ON workspace_links FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_links_insert"
  ON workspace_links FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "workspace_links_delete"
  ON workspace_links FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- commission_rates
-- ========================================
CREATE TABLE commission_rates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_id            uuid NOT NULL REFERENCES income_streams(id) ON DELETE CASCADE,
  source_workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand                text NOT NULL,
  commission_type      text NOT NULL CHECK (commission_type IN ('percentage', 'fixed_per_unit')),
  rate                 numeric(12,4) NOT NULL,
  effective_from       date NOT NULL,
  effective_to         date,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_rates_workspace_stream ON commission_rates(workspace_id, stream_id);
CREATE INDEX idx_commission_rates_source_brand ON commission_rates(source_workspace_id, brand);

ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rates_select"
  ON commission_rates FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "commission_rates_insert"
  ON commission_rates FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "commission_rates_update"
  ON commission_rates FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "commission_rates_delete"
  ON commission_rates FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- holding_expenses
-- ========================================
CREATE TABLE holding_expenses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_id         uuid REFERENCES income_streams(id) ON DELETE SET NULL,
  category          text NOT NULL CHECK (category IN ('operations', 'marketing', 'staffing', 'travel', 'office', 'software', 'legal', 'other')),
  description       text NOT NULL,
  amount            numeric(14,4) NOT NULL,
  currency          text NOT NULL DEFAULT 'GBP',
  expense_date      date NOT NULL,
  vendor            text,
  is_recurring      boolean NOT NULL DEFAULT false,
  recurrence_period text CHECK (recurrence_period IS NULL OR recurrence_period IN ('monthly', 'quarterly', 'annual')),
  receipt_url       text,
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_holding_expenses_workspace ON holding_expenses(workspace_id);
CREATE INDEX idx_holding_expenses_workspace_stream ON holding_expenses(workspace_id, stream_id);
CREATE INDEX idx_holding_expenses_workspace_date ON holding_expenses(workspace_id, expense_date);

ALTER TABLE holding_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holding_expenses_select"
  ON holding_expenses FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "holding_expenses_insert"
  ON holding_expenses FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "holding_expenses_update"
  ON holding_expenses FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "holding_expenses_delete"
  ON holding_expenses FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- stripe_payments
-- ========================================
CREATE TABLE stripe_payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_id               uuid REFERENCES income_streams(id) ON DELETE SET NULL,
  stripe_payment_id       text NOT NULL,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  customer_email          text,
  customer_name           text,
  amount                  numeric(14,4) NOT NULL,
  currency                text NOT NULL DEFAULT 'gbp',
  status                  text NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
  payment_date            timestamptz NOT NULL,
  description             text,
  metadata                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_payment_id)
);

CREATE INDEX idx_stripe_payments_workspace ON stripe_payments(workspace_id);
CREATE INDEX idx_stripe_payments_workspace_date ON stripe_payments(workspace_id, payment_date);

ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_payments_select"
  ON stripe_payments FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Service role inserts via webhooks — no user-facing insert policy needed
-- Admin client bypasses RLS for webhook/sync writes

-- ========================================
-- bank_transactions
-- ========================================
CREATE TABLE bank_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_id         text NOT NULL,
  source              text NOT NULL DEFAULT 'csv_import' CHECK (source IN ('csv_import', 'open_banking')),
  date                date NOT NULL,
  amount              numeric(14,4) NOT NULL,
  currency            text NOT NULL DEFAULT 'GBP',
  counterparty        text,
  reference           text,
  description         text,
  category            text,
  balance_after       numeric(14,4),
  matched_invoice_id  uuid REFERENCES finance_invoices(id) ON DELETE SET NULL,
  matched_expense_id  uuid REFERENCES holding_expenses(id) ON DELETE SET NULL,
  matched_stripe_id   uuid REFERENCES stripe_payments(id) ON DELETE SET NULL,
  reconciled          boolean NOT NULL DEFAULT false,
  notes               text,
  imported_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_id)
);

CREATE INDEX idx_bank_transactions_workspace ON bank_transactions(workspace_id);
CREATE INDEX idx_bank_transactions_workspace_date ON bank_transactions(workspace_id, date);
CREATE INDEX idx_bank_transactions_workspace_reconciled ON bank_transactions(workspace_id, reconciled);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_transactions_select"
  ON bank_transactions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "bank_transactions_insert"
  ON bank_transactions FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "bank_transactions_update"
  ON bank_transactions FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "bank_transactions_delete"
  ON bank_transactions FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- Alter finance_invoices: add stream_id
-- ========================================
ALTER TABLE finance_invoices
  ADD COLUMN stream_id uuid REFERENCES income_streams(id) ON DELETE SET NULL;
