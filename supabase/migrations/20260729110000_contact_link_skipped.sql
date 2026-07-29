-- Linking backlog: a "skip" persists so a deliberately-unlinked contact doesn't
-- reappear as a suggestion every visit.
alter table contacts add column if not exists link_skipped_at timestamptz;
