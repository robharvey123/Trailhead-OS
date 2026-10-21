# Sales seat closeout

Date: 21 October 2026. Covers Phases B0 to G of the sales seat brief. Discovery and decisions are in `SALES_SEAT_DISCOVERY.md`.

| PR | Contents | State |
|---|---|---|
| robharvey123/Trailhead-OS#14 | Security preflight (S1 to S9) | merged, live |
| robharvey123/Trailhead-OS#15 | Shared 28-day CTPS rule, screening round-trip | merged, live |
| robharvey123/Trailhead-OS#16 | Phase B: role, scoped access, invite flow, `/sales` shell, forgot password | merged, live |
| robharvey123/Trailhead-OS#17 | Phases C to G: pipeline, queue, kanban, dashboard, sender identity, open tracking, MCP tools | open |

---

## 1. Migrations

All are applied to production through the Supabase connector and recorded in `supabase_migrations.schema_migrations`.

| File | What it does |
|---|---|
| `20261022100000_security_preflight.sql` | Default role `contractor`; four open tables locked to `is_employee()`; 22 definer views gated; anon loses every view; `report_tokens` and the archive table locked; dormant gmail login downgraded and its events moved |
| `20261022100500_security_preflight_rpc_storage.sql` | Storage buckets `engagement-docs` and `receipts` locked to staff; CRM merge functions check the caller; anon loses EXECUTE on data functions |
| `20261022110000_call_eligibility.sql` | `contact_call_eligibility`: the one rule for who may be phoned |
| `20261023100000_user_role_sales.sql` | `user_role` gains `sales` |
| `20261023110000_sales_access.sql` | Sales scope, narrow grants, restrictive deny everywhere else, write guards, product and campaign views |
| `20261024100000_sales_pipeline.sql` | Pipeline fields, outcome log, `log_sales_outcome`, `set_pipeline_stage` |
| `20261025100000_sales_sender_identity.sql` | Allowed sending domains, `user_sender_identities`, `sales_follow_up_sends` |

**New high-water mark:** `20261025100000`.

A rollback script for the three security and CTPS migrations is in `~/Backups/rollback-security-preflight-2026-10-21.sql`, outside the repo. The last four migrations only add things.

## 2. Routes added

| Route | Who | Purpose |
|---|---|---|
| `/sales/dashboard` | sales, owner, admin | This week against last, stage funnel, list health, product context |
| `/sales/queue` | sales, owner, admin | Today's call queue with the one-click outcome logger |
| `/sales/pipeline` | sales, owner, admin | Kanban by stage, drag to move, filters |
| `/sales/contacts`, `/sales/contacts/[id]` | sales, owner, admin | Scoped list (cards on phones); record with pipeline panel, outcome logger, follow-up email, notes, unsubscribe |
| `/sales/products/[id]` | sales, owner, admin | Read-only product context (name, status, phases, milestones) |
| `/sales/settings` | sales, owner, admin | Own sender identity; owners also set allowed sending domains |
| `/sales/welcome` | sales | First sign-in: name and password |
| `/auth/confirm`, `/auth/accept` | public | Scanner-safe link handling: GET bounces, the button POST verifies |
| `/auth/forgot`, `/auth/set-password` | public, then signed in | Forgot password |

**MCP tools added:** `log_call_outcome`, `set_pipeline_stage`, `sales_dashboard`, `list_queue`. They are documented in `docs/MCP_SERVER.md`. Each acts as Rob and refuses contacts outside the sales lists.

## 3. RLS policies added, and what each denies

**Sales grants** (permissive, `is_sales()` plus scope):

| Policy | Denies |
|---|---|
| `contacts_sales_select` / `contacts_sales_update` | any contact without an `Engineer OS…` or `MVP Cricket…` tag; all inserts and deletes |
| `touchpoints_sales_select` / `touchpoints_sales_insert` | touchpoints on out-of-scope contacts, accounts or engagements; all updates and deletes |
| `outreach_recipients_sales_select`, `outreach_sends_sales_select`, `outreach_events_sales_select` | outreach history for other contacts; every write |
| `email_suppressions_sales_insert` | reading the suppression list, removing entries, suppressing out-of-scope addresses |
| `calendar_events_sales_rw` | other users' calendar entries; links to engagements or projects |
| `workstreams_sales_select` | writes to workstreams |
| `sales_scope_tag_prefixes_sales_select` | changing the scope (admin only) |
| `sales_follow_up_sends_sales_select` | other contacts' follow-ups; all writes (the server writes rows) |
| `user_sender_identities_own` | anyone else's sender identity |

**Deny everywhere else:**
- `<table>_deny_sales`, a restrictive policy on all 158 other RLS tables, denies the seat everything on them. That includes invoices, payments, expenses, time entries, engagements, accounts, enquiries, settings, people, invites, projects and raw campaigns.
- `storage_objects_deny_sales` denies every Storage bucket.

**Staff and anon hardening:**

| Policy or object | Denies |
|---|---|
| `<table>_employee_rw` on `deal_projects`, `meeting_accounts`, `invoice_payments`, `remittance_accounts` | non-staff users (previously open to any signed-in user) |
| `report_tokens_admin_rw` | non-admins; anon lost all access |
| `engagement-docs_employee_*`, `receipts_employee_*` | non-staff users on those buckets |
| `view_gate_allows()` on 22 definer views | anon and non-staff callers |

**Write guards:**
- `contacts_sales_guard` stops the seat changing tags, CTPS fields, phone, email, or the merge, account and workstream links. It also stops it clearing `do_not_call`/`do_not_email` and taking contacts owned by someone else.
- `profiles_role_guard` lets only admins change a role or a linked person.

## 4. Invite flow for Rob

1. Sign in at https://app.trailheadholdings.uk (Forgot password? is on the login page).
2. Go to Admin → Invites.
3. Enter email `francesca@trailheadholdings.uk`, role **Sales Lead** and display name `Francesca Harvey`, then click **Send invite**.
4. She receives "You're set up on Trailhead OS". The link opens a page with an **Accept and sign in** button, so a mail scanner can't use the link up.
5. She chooses a password on `/sales/welcome` and lands on `/sales/dashboard`. From then on she signs in with email and password.
6. To re-send a link, invite the same email again. It sends a fresh one-time link and changes nothing else.

**Before she sends follow-up emails:**
1. Make sure `engineeros.uk` is verified in Resend (section 6).
2. In `/sales/settings`, add `engineeros.uk` under Sending domains (owner only).
3. She then saves her identity there: "Francesca at Engineer OS", `francesca@engineeros.uk`, reply-to the same.

## 5. What the sales role can and cannot see

**Can:**
- contacts tagged `Engineer OS…` or `MVP Cricket…` (100 today), each with:
  - campaign history: sends, deliveries and opens
  - touchpoints and notes
- the queue, pipeline and dashboard
- logging outcomes, booking callbacks and demos, moving stages, claiming contacts
- adding notes, marking a contact unsubscribed, sending follow-ups from its own address
- read-only product context for Engineer OS, MVP Cricket V2 and Before the First Ball

**Cannot:**
- every page outside `/sales` (it is redirected to its dashboard) and every API outside `/api/sales` (403)
- invoices, payments, expenses, time entries, engagements and engagement tasks, accounts, enquiries, company and finance settings, people, invites, MCP tokens
- creating or editing campaigns, templates, caps or windows
- contacts outside the sales tags, and the finance views
- Storage files, and the CRM merge, time-summary and invoice-sequence RPCs

**How each part was verified:**

| What | Where | Result |
|---|---|---|
| 33 OS pages | browser, local stack | all redirect to `/sales/dashboard` |
| 14 APIs | browser, local stack | 403; `/api/enquiries` (public prefix) returns `[]` through RLS |
| 23 direct PostgREST writes | local stack | denied except the allowed ones |
| Rolled-back impersonation of the test seat | production | 100 in-scope contacts, 0 outside; 0 rows from every finance, engagement, settings, people and project table and view and from Storage; 0 rows touched by out-of-scope updates and deletes; logging an outcome works and is scoped |
| Rob's own walkthrough | deployed preview | invite link, welcome page and landing on `/sales/dashboard` |

**Not done:** a browser walkthrough as the sales role on the deployed preview by the agent. Rob decided it wasn't needed. The test seat `robharvey123+salestest@gmail.com` is downgraded to `contractor`.

## 6. Open tracking: finding and fix

**Finding:** Resend has never sent an open or click event.
- `outreach_events` holds 291 `email.sent`, 289 `email.delivered`, 9 `email.delivery_delayed`, 2 `email.bounced`, and no `email.opened` or `email.clicked` at all.
- The webhook logs every event it can match before acting on it, maps `email.opened` to `first_opened_at`, and the stats view reads `first_opened_at`.
- So the code is wired correctly, and the cause is the Resend configuration.

**Code fixes** (webhook only; send logic untouched):
- `delivered_at` is now set only on the first `email.delivered`.
- Follow-up emails are tracked through the same webhook.

**Rob, in the Resend dashboard:**
1. Domains → `mail.engineeros.uk`: turn **Open tracking** and **Click tracking** on.
2. Domains: check `engineeros.uk` (the root, needed for `francesca@engineeros.uk`) is listed and **Verified**. If not, Add domain → `engineeros.uk`, add the DNS records shown, then Verify. Turn on open and click tracking for it too.
3. Webhooks → the endpoint ending `/api/webhooks/resend` → Edit. Make sure these events are ticked, then save:
   - `email.sent`, `email.delivered`, `email.delivery_delayed`
   - `email.bounced`, `email.complained`, `email.failed`
   - **`email.opened`**, **`email.clicked`**

**Are past opens recoverable?** Run this from the main checkout. It's read-only: it lists Resend's `last_event` for each of the 291 sends.

```bash
npx tsx scripts/resend-open-audit.ts
```

- If every `last_event` is `delivered`, tracking was off, there was never a pixel to load, and nothing can be recovered.
- If some show `opened` or `clicked`, only the webhook subscription was missing. Re-run with `--apply` (with Rob's approval) to write them. Recovered opens are dated to the delivery time, because Resend keeps no open timestamp, and are marked `email.opened.recovered` in `outreach_events`.

## 7. Screens

The flows were exercised in a browser against the local stack and shown in the session:
- **Queue:** order, logging a Conversation, advancing to the next row without a reload, a Demo with a date, Disqualified refused without a reason.
- **Pipeline:** a drag from New to Contacted, and Trial to Lost with the reason dialog.
- **Dashboard:** this week against last, list health, stage funnel.
- **Contact record:** pipeline panel, outcome logger, follow-up email form.
- **Settings:** domain checks.

Images were not saved to the repo.

## 8. Deferred, with reasons

| Item | Why |
|---|---|
| Agent-driven preview walkthrough as the sales role | Rob's call; covered by local browser tests plus production RLS impersonation |
| Recovering historical opens | Needs Rob's Resend check first (section 6) |
| `size_rank` values | `scripts/size-rank-propose.ts` writes proposals to `data/size-rank-proposals.csv` for Rob to check; `--apply` saves them. Until then the cold queue orders by opens, then email recency |
| Francesca's sender identity | Needs `engineeros.uk` verified in Resend and added to allowed domains |
| CTPS screening | Rob screens the 104 numbers before 27 October; until then the queue has no callable cold numbers |
| Retiring `/outreach/calls` | Kept owner-only until `/sales/queue` is proven (D5) |
| Demo calendar entries syncing to Google | They are OS calendar rows for the seat; two-way sync for a second user is a separate piece of work |
| Kanban auto-scroll on narrow screens | The board scrolls sideways; dragging to an off-screen column relies on dnd-kit auto-scroll |
| An MVP Cricket list | The scope includes `MVP Cricket…` tags, but no contacts carry one yet |
