-- Add channel and website columns to contacts table
alter table contacts add column if not exists channel text;
alter table contacts add column if not exists website text;

-- Index on channel for filtering
create index if not exists idx_contacts_channel on contacts(channel);
