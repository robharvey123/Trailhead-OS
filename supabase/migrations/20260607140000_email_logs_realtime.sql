-- Make the inbox a live "push" inbox: stream email_logs changes over Supabase
-- Realtime so the UI updates as the gmail-sync cron writes new mail, without a
-- manual "Sync now". RLS still applies on the realtime channel (email_logs is
-- admin-only via is_admin()), so only admins receive the rows.
do $$ begin
  alter publication supabase_realtime add table email_logs;
exception when duplicate_object then null; end $$;
