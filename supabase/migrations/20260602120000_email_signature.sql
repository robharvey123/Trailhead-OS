-- Email signature appended to outbound compose/reply.
alter table os_company_settings add column if not exists email_signature text;
