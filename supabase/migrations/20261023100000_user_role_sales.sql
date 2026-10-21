-- Sales Lead seat: a new value on the existing user_role enum.
-- Own file because a new enum value can't be used in the transaction that
-- adds it; 20261023110000_sales_access.sql uses it. Idempotent.
alter type public.user_role add value if not exists 'sales';
