-- Archive the legacy modules retired in the Nov 2026 streamline (Rob: "just archive").
--
-- Moves tables that no remaining code reads or writes out of `public` into an
-- `archive` schema. Nothing is dropped: rows, foreign keys, indexes and RLS
-- policies move with each table (ALTER ... SET SCHEMA keeps OIDs), and the
-- sell-in/sell-out views move with them so they keep resolving. `archive` is not
-- in PostgREST's exposed schemas, so none of this is reachable through the API.
--
-- Covered: sell-in/sell-out analytics and workspace settings, the holding /
-- finance_* ledger, comms, chat and DMs, crm_deals, inventory and supply chain,
-- staffing and marketing. Tables still referenced by code (workspaces,
-- workspace_tasks, deals, crm_*, ads_*, whatsapp_*, activities) stay in public
-- for a later pass.
--
-- The chat/DM helper functions (is_chat_participant, is_chat_admin,
-- is_in_conversation, chat_bump_conversation, bump_conversation_on_message) stay
-- in public. They are only used by policies and triggers on the archived tables.
--
-- To restore one: alter table archive.<name> set schema public;

create schema if not exists archive;
revoke all on schema archive from anon, authenticated;

-- Views first, so nothing in public is left pointing at archive tables.
alter view if exists public.vw_sell_in_customer_match set schema archive;
alter view if exists public.vw_sell_in_customer_monthly set schema archive;
alter view if exists public.vw_sell_in_customer_sku_monthly set schema archive;
alter view if exists public.vw_sell_in_customer_sku_totals set schema archive;
alter view if exists public.vw_sell_in_customer_totals set schema archive;
alter view if exists public.vw_sell_in_monthly set schema archive;
alter view if exists public.vw_sell_in_sku_monthly set schema archive;
alter view if exists public.vw_sell_out_company_monthly set schema archive;
alter view if exists public.vw_sell_out_company_sku_monthly set schema archive;
alter view if exists public.vw_sell_out_company_sku_totals set schema archive;
alter view if exists public.vw_sell_out_company_totals set schema archive;
alter view if exists public.vw_sell_out_monthly set schema archive;
alter view if exists public.vw_sell_out_platform_monthly set schema archive;
alter view if exists public.vw_sell_out_region_monthly set schema archive;
alter view if exists public.vw_sell_out_sku_monthly set schema archive;

alter table if exists public.sell_in set schema archive;
alter table if exists public.sell_out set schema archive;
alter table if exists public.customer_mappings set schema archive;
alter table if exists public.workspace_settings set schema archive;
alter table if exists public.workspace_audit_log set schema archive;
alter table if exists public.workspace_integrations set schema archive;
alter table if exists public.integration_sync_log set schema archive;
alter table if exists public.report_tokens set schema archive;
alter table if exists public.holding_expenses set schema archive;
alter table if exists public.income_streams set schema archive;
alter table if exists public.commission_rates set schema archive;
alter table if exists public.bank_transactions set schema archive;
alter table if exists public.stripe_payments set schema archive;
alter table if exists public.fx_rates set schema archive;
alter table if exists public.finance_budgets set schema archive;
alter table if exists public.finance_credit_notes set schema archive;
alter table if exists public.finance_expense_claims set schema archive;
alter table if exists public.finance_invoices set schema archive;
alter table if exists public.finance_payments set schema archive;
alter table if exists public.finance_purchase_orders set schema archive;
alter table if exists public.comm_channels set schema archive;
alter table if exists public.comm_messages set schema archive;
alter table if exists public.chat_conversations set schema archive;
alter table if exists public.chat_messages set schema archive;
alter table if exists public.chat_participants set schema archive;
alter table if exists public.chat_attachments set schema archive;
alter table if exists public.chat_message_mentions set schema archive;
alter table if exists public.dm_conversations set schema archive;
alter table if exists public.dm_messages set schema archive;
alter table if exists public.dm_reads set schema archive;
alter table if exists public.crm_deals set schema archive;
alter table if exists public.deal_projects set schema archive;
alter table if exists public.inventory set schema archive;
alter table if exists public.inventory_movements set schema archive;
alter table if exists public.products set schema archive;
alter table if exists public.product_variants set schema archive;
alter table if exists public.product_launches set schema archive;
alter table if exists public.shipments set schema archive;
alter table if exists public.supply_orders set schema archive;
alter table if exists public.staff_profiles set schema archive;
alter table if exists public.staff_schedules set schema archive;
alter table if exists public.staff_time_entries set schema archive;
alter table if exists public.marketing_campaigns set schema archive;
alter table if exists public.marketing_content set schema archive;
alter table if exists public.marketing_assets set schema archive;
