-- ========================================
-- Multi-currency support
-- FX rates table, workspace settings columns, currency on data tables
-- ========================================

-- ========================================
-- 1. FX rates table
-- ========================================
CREATE TABLE fx_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_currency   text NOT NULL,
  to_currency     text NOT NULL,
  rate            numeric(18,8) NOT NULL,
  effective_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, from_currency, to_currency, effective_date)
);

CREATE INDEX idx_fx_rates_workspace ON fx_rates(workspace_id);
CREATE INDEX idx_fx_rates_lookup ON fx_rates(workspace_id, from_currency, to_currency, effective_date);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_rates_select"
  ON fx_rates FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "fx_rates_insert"
  ON fx_rates FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "fx_rates_update"
  ON fx_rates FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
  ));

CREATE POLICY "fx_rates_delete"
  ON fx_rates FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- 2. Workspace settings: add base_currency + supported_currencies
-- ========================================
ALTER TABLE workspace_settings
  ADD COLUMN base_currency text NOT NULL DEFAULT 'GBP',
  ADD COLUMN supported_currencies text[] NOT NULL DEFAULT '{GBP,EUR,USD,SEK,CHF,NOK,DKK}';

-- Migrate old currency_symbol values to base_currency where possible
UPDATE workspace_settings SET base_currency = 'GBP' WHERE currency_symbol = '£';
UPDATE workspace_settings SET base_currency = 'USD' WHERE currency_symbol = '$';
UPDATE workspace_settings SET base_currency = 'EUR' WHERE currency_symbol = '€';

-- Drop old column
ALTER TABLE workspace_settings DROP COLUMN currency_symbol;

-- ========================================
-- 3. Add currency columns to data tables
-- ========================================
ALTER TABLE sell_in
  ADD COLUMN currency text NOT NULL DEFAULT 'GBP';

ALTER TABLE sell_out
  ADD COLUMN currency text NOT NULL DEFAULT 'GBP';

-- crm_deals already has currency column
-- finance_invoices already has currency column
-- finance_purchase_orders already has currency column
-- finance_budgets already has currency column

-- ========================================
-- 4. Drop and recreate analytics views with currency awareness
-- ========================================

DROP VIEW IF EXISTS vw_sell_in_customer_sku_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_in_customer_sku_totals CASCADE;
DROP VIEW IF EXISTS vw_sell_in_customer_totals CASCADE;
DROP VIEW IF EXISTS vw_sell_in_sku_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_in_customer_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_in_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_out_company_sku_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_out_company_sku_totals CASCADE;
DROP VIEW IF EXISTS vw_sell_out_company_totals CASCADE;
DROP VIEW IF EXISTS vw_sell_out_company_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_out_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_out_platform_monthly CASCADE;
DROP VIEW IF EXISTS vw_sell_out_region_monthly CASCADE;

-- sell_in views
CREATE OR REPLACE VIEW vw_sell_in_monthly AS
SELECT
  workspace_id,
  brand,
  currency,
  date_trunc('month', date)::date AS month,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue,
  sum(qty_cans + promo_cans) AS total_shipped
FROM sell_in
GROUP BY workspace_id, brand, currency, date_trunc('month', date)::date;

CREATE OR REPLACE VIEW vw_sell_in_customer_monthly AS
SELECT
  workspace_id,
  brand,
  customer,
  currency,
  date_trunc('month', date)::date AS month,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue,
  sum(qty_cans + promo_cans) AS total_shipped
FROM sell_in
GROUP BY workspace_id, brand, customer, currency, date_trunc('month', date)::date;

CREATE OR REPLACE VIEW vw_sell_in_sku_monthly AS
SELECT
  workspace_id,
  brand,
  product,
  currency,
  date_trunc('month', date)::date AS month,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue,
  sum(qty_cans + promo_cans) AS total_shipped
FROM sell_in
GROUP BY workspace_id, brand, product, currency, date_trunc('month', date)::date;

CREATE OR REPLACE VIEW vw_sell_in_customer_totals AS
SELECT
  workspace_id,
  brand,
  customer,
  currency,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue,
  sum(qty_cans + promo_cans) AS total_shipped
FROM sell_in
GROUP BY workspace_id, brand, customer, currency;

CREATE OR REPLACE VIEW vw_sell_in_customer_sku_totals AS
SELECT
  workspace_id,
  brand,
  customer,
  product,
  currency,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(qty_cans + promo_cans) AS total_shipped,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue
FROM sell_in
GROUP BY workspace_id, brand, customer, product, currency;

CREATE OR REPLACE VIEW vw_sell_in_customer_sku_monthly AS
SELECT
  workspace_id,
  brand,
  customer,
  product,
  currency,
  date_trunc('month', date)::date AS month,
  sum(qty_cans) AS sell_in_units,
  sum(promo_cans) AS promo_units,
  sum(qty_cans + promo_cans) AS total_shipped,
  sum(coalesce(total, qty_cans * unit_price)) AS revenue
FROM sell_in
GROUP BY workspace_id, brand, customer, product, currency, date_trunc('month', date)::date;

-- sell_out views
CREATE OR REPLACE VIEW vw_sell_out_monthly AS
SELECT
  workspace_id,
  brand,
  currency,
  date_trunc('month', month)::date AS month,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY workspace_id, brand, currency, date_trunc('month', month)::date;

CREATE OR REPLACE VIEW vw_sell_out_company_monthly AS
SELECT
  workspace_id,
  brand,
  company,
  currency,
  date_trunc('month', month)::date AS month,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY workspace_id, brand, company, currency, date_trunc('month', month)::date;

CREATE OR REPLACE VIEW vw_sell_out_company_totals AS
SELECT
  workspace_id,
  brand,
  company,
  currency,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY workspace_id, brand, company, currency;

CREATE OR REPLACE VIEW vw_sell_out_company_sku_totals AS
SELECT
  workspace_id,
  brand,
  company,
  product,
  currency,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY workspace_id, brand, company, product, currency;

CREATE OR REPLACE VIEW vw_sell_out_company_sku_monthly AS
SELECT
  workspace_id,
  brand,
  company,
  product,
  currency,
  date_trunc('month', month)::date AS month,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY workspace_id, brand, company, product, currency, date_trunc('month', month)::date;

CREATE OR REPLACE VIEW vw_sell_out_platform_monthly AS
SELECT
  workspace_id,
  brand,
  coalesce(nullif(platform, ''), 'Unknown') AS platform,
  currency,
  date_trunc('month', month)::date AS month,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY
  workspace_id,
  brand,
  coalesce(nullif(platform, ''), 'Unknown'),
  currency,
  date_trunc('month', month)::date;

CREATE OR REPLACE VIEW vw_sell_out_region_monthly AS
SELECT
  workspace_id,
  brand,
  coalesce(nullif(region, ''), 'Unknown') AS region,
  currency,
  date_trunc('month', month)::date AS month,
  sum(units) AS sell_out_units
FROM sell_out
GROUP BY
  workspace_id,
  brand,
  coalesce(nullif(region, ''), 'Unknown'),
  currency,
  date_trunc('month', month)::date;

-- customer match view doesn't need currency (it's just a mapping helper)
