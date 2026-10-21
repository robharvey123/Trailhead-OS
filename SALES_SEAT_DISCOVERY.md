# Sales seat discovery (Phase A)

Date: 21 October 2026. Branch at time of writing: `feat/project-page-board-tasks` (this file is uncommitted; nothing else was changed).

Sources: the code on this checkout, every migration up to `20261005160000_publish_checks_and_voice_drift.sql`, and read-only aggregate queries against the production Supabase project `brand-opps` (`kmeyrtasfffubdwceaop`). No writes were made anywhere.

---

## 0. Read this first

### 0.1 Security problems that exist today (fix before any second user exists)

| # | Problem | Where | Impact |
|---|---|---|---|
| S1 | Self-signup is open. The login page has a "Create account" tab calling `supabase.auth.signUp`, and `handle_new_auth_user` gives every new profile the default role `employee`. | `app/login/LoginForm.tsx:38`, `supabase/migrations/20260604090000_auth_roles.sql:34,66` | `is_employee()` grants full read/write on about 36 core tables, including invoices, contacts and touchpoints. Whether it is reachable depends on the Supabase Auth "Allow new users to sign up" setting, which I cannot read from SQL. |
| S2 | `POST /api/workspace/users` (also re-exported as `/api/analytics/users`) calls `auth.admin.updateUserById(userId, { password })` with the service-role client and no role check. `GET` lists every user's email. `/api/workspace/invite` can create users and grant any workspace role, also unchecked. | `app/api/workspace/users/route.ts:43`, `app/api/workspace/invite/route.ts` | Any signed-in session can reset Rob's password. Combined with S1, potentially anyone. The sales seat would have this power on day one. |
| S3 | Cowork API-key requests act as "the first user" from `auth.admin.listUsers({ page: 1, perPage: 1 })`, not `owner_user_id()`. The key compare is a plain `===`, not timing-safe. | `lib/api/auth.ts:12`, `lib/cowork-auth.ts` | Writes via the API key may be attributed to the dormant `robharvey123@gmail.com` login (role `admin`). Same pattern in `lib/growth/drafting.ts:99`, `lib/growth/links.ts:109`, `app/api/cron/calendar-sync/route.ts:16`. |
| S4 | Five tables went back to the open `auth.role() = 'authenticated'` policy after the June lockdown: `deal_projects`, `engagement_document_files`, `meeting_accounts`, `invoice_payments`, `remittance_accounts`. | the migrations that created them | Any authenticated role, including contractors and the future `sales` role, can read and write invoice payments and remittance accounts. |

Production today has 2 auth users (1 `owner`, 1 `admin`) and no `employee` profiles, so S1 has not been exploited. I recommend a **Phase B0** that fixes S1 to S4 before Phase B adds the role. Details are in section 6.

### 0.2 Facts that change the brief

1. **A role model already exists.** `profiles.role` uses enum `user_role` = `owner | admin | employee | contractor`, with SECURITY DEFINER helpers and an invite system. The brief's "add a role, default existing users to owner" becomes "add `sales` to the existing enum". Defaulting existing users to `owner` would promote the dormant gmail login, so don't.
2. **The call queue is empty on day one.** All 100 campaign recipients have `ctps_checked_at IS NULL`. The current gate hides unscreened numbers, correctly, so queue bucket 4 has 0 rows until the list is CTPS-screened.
3. **The existing CTPS gate has no 28-day window.** A contact counts as clear if it was ever screened and is not registered. The brief wants freshness within 28 days. That is a change to the gate itself and needs Rob's decision (section 7, D1).
4. **The existing call queue does not exclude stopped recipients.** Unsubscribed, bounced and replied recipients still appear if they have a delivered send. The brief asked me to confirm unsubscribe gates the call queue: **it does not.**
5. **`size_signal` is free text**, with 92 distinct values across 100 contacts ("Established 1972; ...", "Headcount not published"). It cannot be ordered "descending". A numeric rank column is needed (D3).
6. **There is no `MVP Cricket` contact tag yet.** The only campaign tag is `Engineer OS outreach 2026-07` (100 contacts), which matches the `Engineer OS` prefix rule.
7. **0 opens is a Resend configuration problem, not a code problem.** See section 5.
8. **The project pages are not safe for sales.** `projects/[workstream]` just redirects. The record page `projects/records/[id]` loads engagements, engagement tasks and time entries. Sales needs its own read-only product page.
9. **There is no `engineer-os` workstream.** The Engineer OS project (`a7a8ef1d-...`) sits under `app-dev`.
10. **There are 18 production crons, not 8.**

---

## 1. Auth model

**Sign-in.** Email and password via `signInWithPassword` (`app/login/LoginForm.tsx:27`). Google and Microsoft OAuth exist only to connect calendar and mail, not to sign in. Nothing calls `signInWithOtp` today.

**Callback.** `app/auth/callback/route.ts` already supports the scanner-safe pattern. With `token_hash` and `type` in `magiclink | recovery | invite | email`, it calls `verifyOtp({ token_hash, type })`. With `code`, it calls `exchangeCodeForSession`. The default `next` is `/analytics`.

**Identity tables.**

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (auth.users), `person_id` (people, unique), `role user_role default 'employee'`, `display_name` | Trigger `handle_new_auth_user` creates a row per auth user. Trigger `enforce_profile_role_change` blocks role changes by non-admins. |
| `invites` | `email, role, person_id, token (64 hex), invited_by, expires_at (7d), claimed_at, claimed_by` | Policy `invites_admin` uses `is_admin()`. |
| `people` | `full_name, email, auth_user_id, default_hourly_rate_gbp, is_active` | The staff/contributor directory. |
| `engagement_contributors` | `engagement_id, person_id, role, hourly_rate_gbp` | Contractor access to engagements. |
| `workspaces`, `workspace_members`, `staff_profiles` | legacy analytics surface | Enum `workspace_role`, separate from the OS. |

**Invite flow today.** `app/(os)/admin/invites/actions.ts` (`createInvite`, behind `requireAdmin`) emails `/auth/claim/<token>`. The claim action uses the service role to create the user with `email_confirm: true`, applies the role and person, signs in with a chosen password and redirects to `/settings`. `ASSIGNABLE_ROLES = ['admin','employee','contractor']` (`lib/types.ts:316`).

**Role checks.**
- In the DB: `app_user_role()`, `is_admin()` (owner, admin), `is_employee()` (owner, admin, employee), `current_person_id()`, `is_self_person()`, `is_on_engagement()`, `owner_user_id()`, `owner_person_id()`. All are SECURITY DEFINER.
- In TypeScript: `lib/auth/roles.ts` provides `getCurrentProfile`, `roleIsAdmin`, `roleIsEmployee`, `isAdmin`, `requireAdmin` (throws).
- In middleware: `/admin/*` only. Everything else in `(os)` needs just a session (`app/(os)/layout.tsx` calls `getUser()`).

**Tenancy.** The OS tables are single-tenant, with no `workspace_id` or `company_id`. Isolation comes entirely from the role helpers in RLS. Standard policy, from `20260604090100_rls_lockdown.sql`:

```sql
create policy <t>_employee_rw on <t> for all to authenticated
  using (is_employee()) with check (is_employee());
```

Secrets and settings tables use `_admin_rw` with `is_admin()`. A new `sales` value is outside `is_employee()`, so **by default sales sees nothing** on every locked-down table. That is the right starting point: we only add narrow grants.

**How API routes reach the database.** There are 287 `route.ts` files.
- 102 use `getAuthenticatedSupabase()`, which returns the user client (RLS applies) for a session and the service role for the API key.
- 130 use the user server client.
- 31 import the service-role client directly: cowork, cron, webhooks, the workspace routes and integrations.

The 31 direct service-role routes ignore RLS, so each needs either a role gate or confirmation that it is token-only (cron or webhook). Middleware deny-by-default for `sales` (section 6) covers them without auditing each one.

**Error convention.** `{ ok: false, error }` appears in only 7 files. Most server actions return `{ error?: string }`, and `requireAdmin` throws. New sales code will follow the brief's `{ ok: false, error }`.

**Migration high-water mark:** `20261005160000_publish_checks_and_voice_drift.sql`. It is the same on every remote branch; none has an unmerged higher number.

---

## 2. Contact and outreach schema

### 2.1 `contacts` (the only live contact table; `crm_contacts` is legacy)

Columns: `id, workstream_id, name, company, email, phone, role, status (lead/active/inactive/archived), notes text, tags text[], account_id, address_line1/2, city, postcode, country, channel, website, freeagent_contact_url, email_greeting, do_not_email, do_not_call, ctps_registered (nullable bool), ctps_checked_at, sub_trade, size_signal, link_skipped_at, merged_into, merged_at, created_at, updated_at`.

| Brief name | Reality |
|---|---|
| `ctps_registered`, `ctps_checked_at` | exist |
| `unsubscribed` | no column. Unsubscribe sets `contacts.do_not_email = true` and inserts into `email_suppressions` |
| `bounced` | no column. Recorded in `email_suppressions (reason 'bounced')` and `outreach_recipients.stopped_reason` |
| `stopped_reason` | on `outreach_recipients`, not contacts |
| sub-trade | `sub_trade` |
| tags | `contacts.tags text[]`. There is no join table for contacts; the normalised `tags`/`account_tags`/`deal_tags` tables cover accounts and deals only |
| notes | `contacts.notes` (a single text field). The `notes` table is task/workstream scoped, not contact scoped |

Production, for the 100 `Engineer OS outreach 2026-07` contacts:
- phone, city, sub_trade and size_signal are populated on all 100; role on 86
- 0 are linked to an account
- 5 have `do_not_email`, 0 have `do_not_call`
- 100 are CTPS-unchecked

### 2.2 Other CRM tables

- **`accounts`**: name, website, industry, size, workstream_id, status (`prospect … archived`), address, notes, tags, channel, source, target_role, merge fields.
- **`deals`**: a pipeline already exists here. `stage` takes `New, Qualified, Proposal Sent, Negotiation, Won, Lost, On Hold`, with an `owner_id`, view `pipeline_summary` and kanban `components/os/DealsClient`. It is account-level (`account_id not null`). The Engineer OS prospects have no accounts, so I recommend **not** reusing `deals` and putting `pipeline_stage` on contacts as the brief says.
- **`activities`**: `type (Email/Call/Meeting/Note/Task), subject, notes, activity_date, next_action, next_action_date`. The existing call logger writes here.
- **`enquiries`**: discovery and contact form submissions.
- **`touchpoints`**: `id, account_id, contact_id, engagement_id, event_id, type ('call','email','message','meeting','note'), subject not null, body, occurred_at`, with a constraint that it must have an account, contact or engagement. It is general-purpose, not email-only. It has no outcome, duration or author column.
- **`calendar_events`**: `title, description, start_at, end_at, all_day, workstream_id, contact_id, project_id, user_id, engagement_id, location, colour, source (manual/google/feed/microsoft), read_only, meet_link`. DEMO can create a row here.

### 2.3 Outreach engine (hardened in Brief 6; read-only for this work except where noted)

| Table | Purpose |
|---|---|
| `outreach_campaigns` | `status, from_name, from_email, reply_to, daily_send_cap, send_window_start/end, send_days, timezone, project_id, audience_id`. One live campaign, sending from `hello@mail.engineeros.uk` |
| `outreach_campaign_steps`, `outreach_templates`, `outreach_step_template_overrides` | sequence and content |
| `outreach_audiences`, `outreach_audience_members` | static audience snapshot |
| `outreach_recipients` | `status (pending/active/completed/stopped), current_step, next_send_at, stopped_reason (replied/unsubscribed/bounced/complained/manual/converted/error), call_status, call_last_at, unsubscribe_token, vars` |
| `outreach_sends` | `resend_email_id, subject, status (queued … complained/failed), sent_at, delivered_at, first_opened_at, first_clicked_at, error`. The brief's `opened_at` is `first_opened_at` |
| `outreach_events` | raw webhook log |
| `email_suppressions` | `email, reason, source, notes`, unique on `lower(email)` |
| view `outreach_campaign_stats` | `opened = count(first_opened_at)` |

Production state: 291 sent, 289 delivered, 2 bounced. Recipients: 93 not stopped, 5 unsubscribed, 2 bounced.

**Suppression** is TypeScript: `isSuppressed()` in `lib/outreach/suppression.ts:10` (fails closed), called from `lib/outreach/scheduler.ts:114` and `lib/outreach/send.ts:54`.

**CTPS gate**: TypeScript, inside `getCallQueue()` at `lib/db/outreach.ts:161`:

```ts
.in('sends.status', ['delivered', 'opened', 'clicked'])
.not('contact.do_not_call', 'is', true)
.not('contact.ctps_registered', 'is', true)
.not('contact.ctps_checked_at', 'is', null)
```

`getUnscreenedCallCount()` (`lib/db/outreach.ts:208`) is the companion count. There is no SQL function or view for the gate.

### 2.4 Existing call queue

- Lives at `app/(os)/outreach/calls/page.tsx` plus `actions.ts`.
- Query: recipients with any delivered send, filtered by the gate above, sorted by first delivery.
- Renders: company, phone, website, sub_trade, size_signal and the last `call_status`.
- `logCallOutcome` inserts into `activities` (`type 'Call'`), updates `outreach_recipients.call_status`/`call_last_at`, and sets `do_not_call` on that outcome. It writes **no touchpoint**.
- Outcome values are `no_answer, voicemail, connected, interested, not_interested, callback, bad_number, do_not_call`, a different vocabulary from the brief's ten codes.

---

## 3. Navigation and routes

**Shell.** `app/(os)/layout.tsx` renders `components/os/OsShell.tsx`: Sidebar, Topbar, Cmd-K palette, timer and push banner. It loads six badge counts: tasks, mail, messages, mentions, new enquiries and draft quotes.

**Sidebar.** `components/os/Sidebar.tsx` uses a static `NAV_GROUPS` with **no role filtering**:
- Top: Dashboard, Calendar, Tasks, Messages, Inbox
- Delivery: Engagements, Projects, Timesheet
- Clients: Accounts, Contacts, Meetings, Deals, Outreach, Enquiries
- Commercial: Quotes, Invoicing, Expenses
- Insights: Analytics, Growth, Weekly Report
- Content: Blog, Discovery form
- Footer: Settings, Sign out

**Workstream switcher.** There isn't one. `components/nav/WorkspaceNav.tsx` is the legacy analytics workspace nav. Workstreams are rows in `workstreams` (`brand-sales, ecommerce, app-dev, mvp-cricket, consulting, personal`).

**Hosts.** `middleware.ts` treats `app.*` as the OS and every other host as marketing. On localhost, `?site=marketing` switches to marketing. Public API prefixes skip the session check: `/api/enquiries, /api/contact, /api/calendar/ical, /api/cowork, /api/cron, /api/mcp, /api/webhooks/resend, /api/outreach/unsubscribe`.

**OS routes (`app/(os)`).** These are the finance or otherwise sensitive ones the `sales` role must not reach:
- Finance and engagement data: `engagements/**`, `timesheet`, `quotes/**`, `invoicing/**`, `expenses/**`, `reports/hours-by-*`, `reports/weekly`
- Settings and admin: `settings/**` (company and invoice settings), `admin/**`
- Analytics and growth: `analytics/**`, `growth/**`
- The outreach engine admin: `outreach/new`, `outreach/templates`, `outreach/audiences`, `outreach/[id]`
- `projects/records/**`, because it loads time and engagements
- Everything else in `(os)`, for example `messages`, `inbox` and `deals`, is also out of scope for sales

---

## 4. MCP and API-key surface

- **Routes.** `app/api/mcp/route.ts` (Bearer) and `app/api/mcp/c/[token]/route.ts` (claude.ai connector) both serve `lib/mcp/handler.ts` over `lib/mcp/tools.ts`.
  - The connector route compares the URL secret to `MCP_CONNECTOR_TOKEN` (48+ characters, `timingSafeEqual`, 404 on mismatch) and rate-limits to 120/min per IP.
- **Auth.** `validateCoworkToken` (`lib/cowork-auth.ts`) compares the Bearer token to the single env var `COWORK_API_KEY`. There is no token table, nothing is tied to a user, and `whoami` returns `cowork-token`. The 48 `/api/cowork/*` routes share the same key.
- **Database client.** All tools use `supabaseService` (service role), so they bypass RLS.
- **What this means for the sales seat.** It never receives `COWORK_API_KEY` or the connector URL, so it cannot use the MCP. It also does not need to touch the MCP auth path. The risk lies in the other direction: a sales **session cookie** must not unlock service-role routes. Middleware deny-by-default covers that (section 6).
- **Tools (56), grouped:**
  - Health: `whoami`
  - Projects, phases and milestones: list, get, create, update and delete
  - Kanban tasks and notes
  - The engagement ticket board
  - `briefing`
  - Engagements and hours: `engagement_hours_check`
  - Time and expenses: `log_time`, `log_expense`, `bill_expenses`
  - Tier 1: `set_milestone_gate`, `raise_listing_invoice`, `add_tier1_account`
  - Invoices and payments
  - CRM: `find_account`, `create_account`, `update_account`, `update_contact`
  - Other records: `update_calendar_event`, `update_enquiry`, `update_settings`, `delete_touchpoint`
  - Outreach: `list_outreach_campaigns`, `get_campaign_stats`
  - Engagement documents
  - `recent_cowork_activity`

Phase G adds four tools to `lib/mcp/tools.ts` in the same style, running as owner, with `logged_by_user_id = owner_user_id()`.

---

## 5. Open tracking (Phase F preview, found during discovery)

- The webhook `app/api/webhooks/resend/route.ts` is Svix-verified.
  - It matches `outreach_sends.resend_email_id`.
  - It writes a raw `outreach_events` row for every matched event.
  - It handles `email.opened` (sets `first_opened_at`) and `email.clicked` (sets `first_clicked_at`).
  - The stats view reads `first_opened_at`. The column names line up end to end.
- Production `outreach_events` by type: `email.sent` 291, `email.delivered` 289, `email.delivery_delayed` 9, `email.bounced` 2, **`email.opened` 0, `email.clicked` 0**.
- Because the handler logs every matched event before acting on it, Resend has never sent an opened or clicked event. The cause is one of these, both in the Resend dashboard:
  1. Open and click tracking is off on the domain `mail.engineeros.uk`.
  2. The webhook endpoint is not subscribed to `email.opened` / `email.clicked`.
- `lib/outreach/send.ts:117` passes no tracking options, which is fine; Resend controls tracking per domain.
- **Recoverability.**
  - If tracking was off (cause 1), the sent emails contain no pixel, so historical opens cannot be recovered.
  - If only the subscription was missing (cause 2), Resend's `GET /emails/{id}` returns a `last_event`, from which we could backfill `opened`/`clicked` status. A precise open timestamp may not be available.
  - To tell which cause applies, open any delivered email in the Resend dashboard and look for an open-tracking pixel or a tracking flag.
- **Minor code nit, in the webhook only.** `delivered_at` is overwritten on every repeated `email.delivered`. It should be set only when null. This is safe to fix in Phase F.

---

## 6. Plan

### 6.1 Design principles

1. **Use the existing role system.** Add `sales` to `user_role`. Because `sales` is outside `is_employee()` and `is_admin()`, it inherits zero access, and we add narrow policies.
2. **Deny by default in middleware.** A `sales` profile may reach only an allowlist of paths: `/sales/**`, `/api/sales/**`, `/auth/**`, `/logout`, `/login`. Every other app path redirects to `/sales/dashboard`, and other `/api` paths return 403. This blocks the 31 direct service-role routes without auditing each one. RLS remains the real control; middleware is defence in depth.
3. **Use a separate route group `app/(sales)`** with its own layout and shell. The sales seat never renders `OsShell` or its finance badge queries. Owner can open `/sales/**` too.
4. **Keep one CTPS gate.** Extract the gate into one SQL function, `contact_call_clearance(contact_id)`, that both the existing `/outreach/calls` and the new queue use. The brief's "do not write a second one" is satisfied by moving the existing logic into one place, not copying it.
5. **Put outcome logic in the database.** A single `log_sales_outcome(...)` plpgsql function, SECURITY INVOKER so RLS applies to the caller, applies stage transitions. The server action and the MCP tool both call it, so the rules live in one place.

### 6.2 Migrations (numbered after `20261005160000`, all idempotent)

| File | Phase | Contents |
|---|---|---|
| `20261022100000_security_preflight.sql` | B0 | Replace open policies on `deal_projects, engagement_document_files, meeting_accounts, invoice_payments, remittance_accounts` with `is_employee()` (or `is_admin()` for the finance ones). Include a guarded check that lists any remaining `pg_policies` with `auth.role() = 'authenticated'` or `true`, and fix those found. Change the `profiles.role` default from `employee` to `contractor`, the least-privileged existing value. |
| `20261022110000_user_role_sales.sql` | B | `alter type user_role add value if not exists 'sales';`. This is its own file because a new enum value cannot be used in the same transaction it was added in. |
| `20261022120000_sales_scope.sql` | B | Helpers: `is_sales()` and `is_owner_or_sales()`. A sales-scoped contact predicate, `contact_in_sales_scope(uuid)`, is true when any tag starts with a prefix in a `sales_scope_tag_prefixes` table, seeded with `Engineer OS` and `MVP Cricket` so Rob can extend it without a migration. All three helpers are SECURITY DEFINER with `search_path` set. `projects.sales_visible boolean default false`, set true for Engineer OS (`a7a8ef1d`), MVP Cricket V2 (`9a864507`) and Before the First Ball (`6b901fe6`). Policies in 6.4. A trigger `contacts_sales_guard` stops a sales user changing `tags`, `ctps_*`, `merged_*`, `workstream_id` or `account_id`, and stops them clearing `do_not_call`/`do_not_email`. |
| `20261023100000_sales_pipeline.sql` | C | Enum `contact_pipeline_stage`. Contact columns: `pipeline_stage default 'new'`, `owner_user_id`, `next_action_at`, `next_action_note`, `lost_reason`, `disqualified_reason`, `recontact_after`, `engineer_os_org_id`, `size_rank smallint`, plus indexes on `(pipeline_stage)` and `(owner_user_id, next_action_at)`. Backfill in-scope contacts to `new`. Touchpoints: widen the `type` check to add `demo`, `linkedin`; add `outcome_code` (enum `sales_outcome_code`), `duration_seconds`, `logged_by_user_id`; add a check requiring `body` when the outcome is `CONV`/`DEMO`/`DQ`/`LOST`. Function `log_sales_outcome(...)`. |
| `20261023110000_call_clearance.sql` | D | `contact_call_clearance(contact_id)` returns `clear`, `unscreened`, `stale`, `registered`, `do_not_call`, `suppressed` or `stopped`. It folds in the existing three conditions, plus the 28-day freshness check if D1 is approved, plus `email_suppressions` and recipient `stopped_reason`. Also view or function `sales_queue(p_user uuid)` returning the four buckets with rank. |
| `20261024100000_sales_sender_identity.sql` | E | `user_sender_identities (user_id pk, from_name, from_email, reply_to)` with owner-only RLS on its own row. `os_company_settings.verified_sending_domains text[]`: no such setting exists today, so this is the "configured in settings" list, validated against Resend's domain API when saved. `sales_follow_up_sends (id, contact_id, touchpoint_id, user_id, resend_email_id unique, subject, status, sent_at, delivered_at, first_opened_at, first_clicked_at)`. |

Phase F is expected to need no migration; it is a webhook nit plus dashboard steps.

### 6.3 Reuse versus new, and why

| Brief asks | Plan | Reason |
|---|---|---|
| `channel` on touchpoints | reuse `touchpoints.type`, widened to add `demo`, `linkedin` | `type` already means channel. A second column would duplicate it. |
| `summary` | reuse `touchpoints.body`; `subject` gets the outcome label | `subject` is `not null` already; `body` is the free text. |
| `call_outcomes` table | not needed | touchpoints is already general-purpose |
| a new calendar table | reuse `calendar_events` with `contact_id` and `user_id` | it already exists |
| pipeline on `deals` | no; put it on `contacts` | deals require an account, and the prospects have none |
| a new role column | add `sales` to the existing enum | a role model already exists |
| a new invite system | extend `invites` and `admin/invites` | already built; `invites.role` is a `user_role` |

### 6.4 RLS added in Phase B (all policies `to authenticated`)

| Table | Sales policy | What it denies |
|---|---|---|
| `contacts` | select and update where `is_sales() and contact_in_sales_scope(id)` | every contact outside the sales tags; insert and delete |
| `touchpoints` | select and insert where the contact is in scope | touchpoints on accounts, engagements and other contacts; update and delete |
| `outreach_recipients`, `outreach_sends`, `outreach_events` | select where the contact is in scope | other recipients; all writes |
| `outreach_campaigns`, `outreach_campaign_steps` | select only | create, edit, caps, windows and status (campaign admin) |
| `outreach_templates`, `outreach_audiences*` | no policy | everything |
| `email_suppressions` | insert only, with `reason = 'manual'` or `'unsubscribed'` | reading the list; deleting a suppression |
| `calendar_events` | select, insert and update where `user_id = auth.uid()` | Rob's calendar |
| `projects`, `project_phases`, `project_milestones` | select where `sales_visible` | every other project; all writes |
| `user_sender_identities` | own row only | other users' identities |
| `profiles` | select own row (already allowed) | changing role (existing trigger) |
| invoices, payments, expenses, time entries, engagements, engagement tasks, settings and tokens | nothing added; `is_employee()`/`is_admin()` already exclude `sales` | all of it |

I'll verify every row in this table in Phase B by signing in as the sales user and querying each denied table through the user client.

### 6.5 Routes and code

```
app/(sales)/layout.tsx                 role gate (sales or owner), SalesShell
app/(sales)/sales/dashboard/page.tsx   this week vs last week, funnel, list health
app/(sales)/sales/queue/page.tsx       four buckets, inline outcome logger, no reload
app/(sales)/sales/pipeline/page.tsx    kanban by stage, filters (tag, owner, sub-trade)
app/(sales)/sales/contacts/[id]/page.tsx  record, campaign history, sends/opens, touchpoints, notes, follow-up email
app/(sales)/sales/products/[id]/page.tsx  read-only project summary (phases, milestones, status)
app/(sales)/sales/settings/page.tsx    own sender identity
app/(sales)/sales/actions.ts           logOutcome, setStage, claimContact, markUnsubscribed, addNote, sendFollowUp
lib/sales/{scope,queue,outcomes,dashboard,follow-up}.ts
lib/auth/roles.ts                      + roleIsSales, requireOwnerOrSales (returns { ok:false } rather than throwing in actions)
middleware.ts                          sales allowlist (deny by default)
components/os/Sidebar.tsx              owner gets a "Sales" group linking /sales/*; no change otherwise
app/(os)/admin/invites                 role picker gains "sales"; magic-link email
app/auth/callback/route.ts             role-based default landing; validate `next` is a same-origin path
app/api/webhooks/resend/route.ts       Phase E: also match sales_follow_up_sends; Phase F: delivered_at nit
lib/mcp/tools.ts                       Phase G: log_call_outcome, set_pipeline_stage, sales_dashboard, list_queue
```

**Invite flow.**
1. Rob enters an email and the role `sales`.
2. The server action creates the `invites` row, then calls `auth.admin.generateLink({ type: 'invite' })` to obtain `hashed_token`.
3. It emails our own link, `https://app.trailheadholdings.uk/auth/callback?token_hash=…&type=invite&next=/sales/dashboard`, through Resend. This is the scanner-safe convention: a mail scanner fetching the link does not consume a one-time code.
4. The callback verifies the link, applies the invite role (`sales`) and lands on `/sales/dashboard`.
5. An optional "set a password" step follows, so later sign-ins don't need a magic link.

The existing password claim flow stays for the other roles.

**Existing `/outreach/calls`.** It stays owner-only and keeps working. It switches to `contact_call_clearance()` so there is one gate. Its logger keeps writing `activities`; making it write touchpoints instead is deferred (D5).

### 6.6 Verification approach

Each phase ends with typecheck, lint and build. Then, in a real browser against the Vercel preview:
1. Sign in as the sales user.
2. Try every denied route: each should redirect.
3. Query each denied table with the user client: each should return 0 rows or error.
4. Run the queue, log each outcome type, book a callback, drag on the pipeline and check the dashboard.

Section 7, D8, covers which database the preview uses.

---

## 7. Decisions needed from Rob before Phase B

| # | Decision | My recommendation |
|---|---|---|
| D0 | Do Phase B0 (S1 to S4) first, as part of this work? | **Yes.** Also turn off "Allow new users to sign up" in Supabase Auth settings (the dashboard toggle; I can't change it from SQL). Invites keep working because they use the admin API. |
| D1 | Add the 28-day CTPS freshness rule to the shared gate, which also tightens the existing `/outreach/calls`? | **Yes, one gate.** TPS/CTPS screening must be fresh within 28 days under PECR, so the current "ever screened" rule is too loose for both queues. |
| D2 | The list is 100% unscreened, so the cold queue will be empty. Who screens, and when, before she starts? | Screen the 93 active recipients before day one. Add a "screen now" count to list health. |
| D3 | `size_signal` is free text. Add `size_rank smallint` (1 to 4 bands) to sort by, and backfill it? | **Yes.** I can draft the bands from the text for you to check. The text stays as evidence. |
| D4 | Exclude email-unsubscribed, bounced and complained contacts from the call queue? | **Yes**, as the brief says. Legally an email opt-out does not bar a call, but it is the right courtesy. `replied` recipients stay in, since they are warm. |
| D5 | Should the old `/outreach/calls` logger keep writing `activities`? | Leave it for now. The sales queue writes touchpoints. Retire `/outreach/calls` once the new queue is proven. |
| D6 | Reuse touchpoints `type` as the channel and `body` as the summary (6.3)? | **Yes.** |
| D7 | Which projects should sales see as product context? | Engineer OS, MVP Cricket V2, and Before the First Ball. |
| D8 | Where do migrations run? Does the Vercel preview point at the production Supabase? | If preview uses prod, I write migrations and you apply them, as with MVP Cricket. The sales test user would then be a real account in prod; use her real email, or a `+test` alias you delete afterwards. |
| D9 | The new seat's email and display name, and her sending address (on `mail.engineeros.uk`?) | Needed for Phases B and E. |
| D10 | The dormant `robharvey123@gmail.com` profile has role `admin`. Downgrade it or delete it? | Downgrade it to `contractor`, or delete the auth user, so the S3 "first user" bug cannot act through it. |
| D11 | Phase F: check Resend for (a) open and click tracking on `mail.engineeros.uk` and (b) the webhook's subscribed events. | I'll write the click-by-click steps in the closeout. A quick look now tells us whether a backfill is possible. |


---

## 8. Decisions (Rob, 21 October 2026)

| # | Decision | Chosen |
|---|---|---|
| D0 | Security first | **Yes.** Fixed in its own PR (robharvey123/Trailhead-OS#14) before any Phase B work. Rob turns off public sign-ups in Supabase Auth himself. |
| D1 | 28-day CTPS rule | **Yes.** There is one shared rule, the view `contact_call_eligibility` (migration `20261022110000`), wrapped by `lib/outreach/call-eligibility.ts`. A contact is callable when ctps_registered = false, ctps_checked_at is within 28 days, it is not unsubscribed, not bounced, not do_not_call, and it has a phone. The existing `/outreach/calls` queue and the future `/sales/queue` both use it, and nothing else reads `ctps_*` to decide who to call. |
| D2 | Screening | Rob screens the 93 active recipients and the 11 reserves before 27 October using `scripts/export-ctps-screening.ts` (export, merge, then import). The contact importer now applies CTPS results to existing contacts, matched by email. |
| D3 | `size_rank` | Recommendation taken: add `size_rank smallint` (1 to 4) in Phase C. I draft the bands from the `size_signal` text for Rob to check. |
| D4 | Unsubscribed and bounced excluded from calls | **Yes**, via the rule in D1. `replied` recipients stay callable. |
| D5 | Old `/outreach/calls` logger | Recommendation taken: it keeps writing `activities` and stays owner-only. It is retired once `/sales/queue` is proven. |
| D6 | Touchpoints | Recommendation taken: `type` widens to act as the channel, `body` is the summary, and `subject` is the outcome label. |
| D7 | Product context for sales | Recommendation taken: Engineer OS, MVP Cricket V2, and Before the First Ball. They are exposed through narrow read-only views. Sales never gets direct access to `projects`, which carries `hourly_rate`, `currency`, `account_id` and `engagement_id`. |
| D8 | Database for preview | Preview shares the production Supabase project. **Finding:** Vercel has no Supabase variables for the Preview environment (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set for Development and Production only). Rob needs to add them for Preview before a preview deployment can sign anyone in. Rob applies the migrations after a `pg_dump` backup. Francesca's login is a real production account created through the invite flow. |
| D9 | Sales Lead identity | Display name Francesca Harvey. Login email `francesca@trailheadholdings.uk` (confirmed 21 Oct). Sending address `francesca@engineeros.uk`, with reply-to the same and from name "Francesca at Engineer OS". The sending domain is the root `engineeros.uk`, while the campaign sends from `mail.engineeros.uk`. Phase E checks that `engineeros.uk` itself is verified in Resend. |
| D10 | Dormant gmail login | Recommendation taken: downgraded to `contractor` in the security migration, and its 195 synced Google events move to the owner. |
| D11 | Open tracking | Rob checks the Resend dashboard, using the steps in the Phase B report. |

### 8.1 Further security findings while fixing S1 to S4

| # | Problem | Fix (PR #14) |
|---|---|---|
| S5 | 22 SECURITY DEFINER-style views (Postgres views run with their owner's rights, so they ignore RLS) were selectable with the public anon key. They include `account_overview`, `account_time_totals`, `engagement_hours_by_month` and the sell-in/sell-out analytics. | Every non-invoker view is gated by `view_gate_allows()` (service role, postgres or `is_employee()`), and anon loses SELECT on all public views. |
| S6 | `report_tokens` could be listed with the anon key, and `tasks_backlog_archive_20261013` had RLS off and anon SELECT. | The report page looks tokens up with the service role; admin-only policy; RLS on the archive table. |
| S7 | Middleware passed through a client-supplied `x-api-key-verified` header. A production probe got 401, so it was not exploitable there. | The header is stripped on every request. |
| S8 | The `engagement-docs` and `receipts` Storage buckets were readable, writable and deletable by any authenticated user. | `is_employee()` only. |
| S9 | `crm_merge_contacts`, `crm_merge_accounts` and `crm_merge_generic` were SECURITY DEFINER, executable by anon, with no caller check. | They now refuse non-staff callers, and anon loses EXECUTE on every data function. |

**Schema drift noticed (not fixed, just recorded).** Production has objects that no migration creates:
- the Storage policies `authenticated can … engagement docs/receipts`
- `tasks_backlog_archive_20261013`
- an `auth.uid() is null` bypass in `enforce_profile_role_change()`

The Phase B migration brings the role-guard function into the repo so local and production match.

## 9. Phase B verification on production (21 October 2026)

- **Migrations:** all five applied to production through the Supabase connector and recorded in `supabase_migrations.schema_migrations`. Rob chose to rely on Supabase's daily backups plus a targeted rollback script (kept outside the repo in `~/Backups`) instead of a `pg_dump`. A rolled-back dry run against production came first.
- **Anon key:** gets 401 from every gated view, `report_tokens`, the archive table, `contact_call_eligibility`, the merge RPC and `dm_directory`, and lists nothing in Storage.
- **Rob's walkthrough on the deployed preview:** he invited a test seat (`robharvey123+salestest@gmail.com`). The scanner-safe link signed it in, the welcome page set its password and marked the invite claimed, and it landed on `/sales/dashboard`. The forgot-password flow also worked end to end for Rob's own login.
- **RLS as that seat** (impersonated in a rolled-back transaction on production):
  - it sees all 100 in-scope contacts and none outside the tags
  - zero rows from invoices, invoice payments, expenses, time entries, engagements, accounts, enquiries, company settings, projects, people, raw campaigns, `account_overview`, `engagement_hours_by_month` and Storage
  - it can read the campaign name, the 3 shared products and the 291 sends for its contacts
  - updating or deleting contacts outside its scope affects 0 rows
- **Not done, by Rob's decision:** the agent-driven browser walkthrough as the sales role on the preview (denied routes and APIs in the browser, notes and unsubscribe on a production contact). The same checks passed on the local stack, and the RLS layer is verified on production as above.
- **Cleanup:** the test seat was downgraded to `contractor` afterwards.
