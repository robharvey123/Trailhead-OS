-- Expenses join the engagement model. An expense on a client engagement was
-- only tied to it indirectly (project/account); now it links directly, so the
-- Cowork API can derive links the same way time entries do and engagement
-- detail can report unbilled expenses. `source` distinguishes Cowork-created
-- rows, matching time_entries.source.
alter table expenses
  add column if not exists engagement_id uuid references engagements(id) on delete set null,
  add column if not exists source text not null default 'os' check (source in ('os','cowork','import'));

create index if not exists idx_expenses_engagement_id on expenses(engagement_id);
