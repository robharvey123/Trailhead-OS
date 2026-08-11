-- Let a touchpoint be logged FROM a calendar event (the "Log to CRM" action). The
-- touchpoint is an independent, editable record; event_id just traces it back to the
-- source event and lets us show which events have been logged. on delete set null so
-- deleting an event never destroys the interaction history (matches engagement_id).

alter table touchpoints
  add column if not exists event_id uuid references calendar_events(id) on delete set null;

create index if not exists idx_touchpoints_event_id on touchpoints (event_id);
