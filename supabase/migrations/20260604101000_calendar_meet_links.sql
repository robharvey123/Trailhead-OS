-- ============================================================================
-- Store the Google Meet link and the Google event URL on app-created calendar
-- events so the UI can show "Join Meet" / "Open in Google Calendar" immediately
-- without re-fetching. Nullable + additive: synced/feed events simply leave
-- them null. Populated when an app-created event is pushed to Google.
-- ============================================================================

alter table calendar_events
  add column if not exists meet_link text,
  add column if not exists html_link text;
