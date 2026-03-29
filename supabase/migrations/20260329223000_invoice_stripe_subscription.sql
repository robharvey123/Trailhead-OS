alter table invoices
  add column if not exists stripe_subscription_id text;
