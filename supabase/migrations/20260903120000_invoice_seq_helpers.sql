-- Helpers for the invoice-ledger acceptance harness (scripts/invoice-ledger-acceptance.ts).
-- Scratch invoices consume invoice_number_seq and would leave gaps in the (legally
-- unbroken) TH- numbering, so the harness peeks the sequence before it runs and
-- restores it after cleanup. Locked to service_role: never callable from the app.
create or replace function invoice_seq_peek()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('last_value', last_value, 'is_called', is_called)
  from invoice_number_seq;
$$;

create or replace function invoice_seq_restore(v bigint, called boolean default true)
returns bigint
language sql
security definer
set search_path = public
as $$
  select setval('invoice_number_seq', v, called);
$$;

revoke all on function invoice_seq_peek() from public, anon, authenticated;
revoke all on function invoice_seq_restore(bigint, boolean) from public, anon, authenticated;
grant execute on function invoice_seq_peek() to service_role;
grant execute on function invoice_seq_restore(bigint, boolean) to service_role;
