alter table enquiries
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists project_type text,
  add column if not exists referral_source text;
