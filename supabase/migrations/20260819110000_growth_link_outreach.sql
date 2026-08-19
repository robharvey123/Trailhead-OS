-- Growth: automated link outreach on the existing outreach engine.
--
-- outreach_recipients.vars: per-recipient merge tokens, merged over the
-- contact-derived vars at render time. This is what lets ONE campaign template
-- ({{pitch_subject}} / {{pitch_body_html}}) deliver a fully personalised pitch
-- per recipient — and it's a general engine capability, not link-specific.
alter table outreach_recipients add column if not exists vars jsonb not null default '{}';

-- Link-target columns for the automated chain:
--   contact search  → contact_id / contact_search_at / contact_note
--   pitch drafting  → pitch_subject / pitch_body (markdown) / pitch_generated_at
--                     / pitch_article_id (the article being pitched)
--   engine handoff  → recipient_id (set when queued; the engine then owns
--                     sending, the 7-day follow-up step and stop-on-reply)
--   reply handling  → reply_processed_at (classification runs once per reply)
alter table seo_link_targets add column if not exists contact_id uuid references contacts(id) on delete set null;
alter table seo_link_targets add column if not exists contact_search_at timestamptz;
alter table seo_link_targets add column if not exists contact_note text;
alter table seo_link_targets add column if not exists pitch_subject text;
alter table seo_link_targets add column if not exists pitch_body text;
alter table seo_link_targets add column if not exists pitch_generated_at timestamptz;
alter table seo_link_targets add column if not exists pitch_article_id uuid references seo_articles(id) on delete set null;
alter table seo_link_targets add column if not exists recipient_id uuid references outreach_recipients(id) on delete set null;
alter table seo_link_targets add column if not exists reply_processed_at timestamptz;

-- One engine campaign per site, created on first queue and reused after.
alter table seo_sites add column if not exists outreach_campaign_id uuid references outreach_campaigns(id) on delete set null;
