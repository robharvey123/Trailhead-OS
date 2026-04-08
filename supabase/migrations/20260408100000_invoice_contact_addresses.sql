alter table contacts
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists postcode text,
  add column if not exists country text default 'UK';

alter table invoices
  add column if not exists bill_to_name text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_city text,
  add column if not exists bill_to_postcode text,
  add column if not exists bill_to_country text,
  add column if not exists bill_to_email text,
  add column if not exists bill_to_phone text;

create index if not exists idx_contacts_postcode on contacts(postcode);