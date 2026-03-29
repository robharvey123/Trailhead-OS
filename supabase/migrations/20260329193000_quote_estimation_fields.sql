alter table quotes
  add column if not exists estimated_hours numeric,
  add column if not exists estimated_timeline text,
  add column if not exists complexity_breakdown jsonb;
