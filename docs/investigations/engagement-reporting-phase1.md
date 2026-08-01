# Engagement Reporting — Phase 1 Investigation Findings

**Date:** 2026-07-31
**Scope:** Trailhead OS (`~/App Dev/brandopps`). Engagement report generation, PDF export, email delivery.
**Method:** Migration files + code read directly; schema and data confirmed with live service-role queries against the production Supabase. Types were not trusted as the source of truth.

---

## HEADLINE FINDING (Q3.2 — inverted)

**The brief's highest-priority hypothesis is FALSE, in a good way.** `engagement_tasks.completed_at` **exists**, is a real `timestamptz`, and is **automatically maintained by a trigger** on the transition into/out of `done`. Furthermore a **full status-transition history exists** in `engagement_task_activity` (`kind = 'status_changed'`, payload `{from,to}`, `created_at`), and that log **is populated** in production.

Live check (246 tasks): 23 tasks are `done`, and **all 23 have a `completed_at`; 0 done-without-timestamp; 0 timestamp-without-done.** The completed-in-period query is therefore already period-accurate for completed work.

**Two real caveats remain, and they are the actual Phase 2 problem:**

1. **`completed_at` is mutable and reset-on-reopen.** The trigger sets `completed_at = now()` when a task first becomes `done`, and **nulls it whenever status leaves `done`**. Re-completing stamps a *new* `now()`. So the column reflects the *latest* completion, not the historical one. The immutable truth lives only in `engagement_task_activity`.
2. **There is no `started_at`** and no timestamp for the `in_progress`/`review` transitions on the row itself — those are only reconstructable from `engagement_task_activity`.

So: period reporting of **completed** work is well-supported today; **"in progress at period end"** and **"scheduled for next period"** are *not* currently derived at all (see Q2), and would need the activity log or new columns.

---

## SECOND-HIGHEST FINDING (Q8 — client data leakage)

The client receives an **XLSX timesheet attachment** (`lib/reports/xlsx.ts`, emailed by `lib/reports/send.ts`). Its **Detail** sheet writes, per time entry:

- **`Notes`** — the raw `time_entries.description` (internal execution notes), **always**.
- **`Rate`** — `rate_snapshot`, **always** (not gated by billable).
- **`Value`** — gated by `engagement.is_billable`, but still exposes effective billing when billable.
- **`Person`** full names, plus **By Person / By Project value** breakdowns.

35 `time_entries` rows currently carry a non-null `rate_snapshot`, so this is live data, not a theoretical path. **This is the most serious client-facing exposure in the current pipeline** and there is no projection/stripping layer between `ReportData` and the artifacts.

---

## 1. Report generation surfaces

There are **three distinct engagement-facing report surfaces**, plus separate analytics surfaces. They do **not** share a rendering pipeline.

### 1.A The main pipeline — "engagement reports" (LLM + PDF + XLSX + email)

| Concern | Path |
|---|---|
| Reports list page | `app/(os)/engagements/[id]/reports/page.tsx` |
| Single report review page | `app/(os)/engagements/[id]/reports/[reportId]/page.tsx` |
| Server actions | `app/(os)/engagements/[id]/reports/actions.ts` |
| Generate button (client) | `components/os/engagements/GenerateReportControls.tsx` (exposes `weekly_client`, `monthly_client` only) |
| Review/edit/send UI | `components/os/engagements/ReportReviewClient.tsx` |
| Data gather | `lib/reports/data.ts` → `gatherReportData()` |
| AI narrative | `lib/reports/narrative.ts` → `generateNarrative()` |
| Orchestration | `lib/reports/generate.ts` → `generateEngagementReport()`, `rerenderReportPdf()`, `signedReportUrl()` |
| PDF | `lib/reports/pdf.tsx` → `renderReportPdf()` |
| XLSX | `lib/reports/xlsx.ts` → `buildReportXlsx()` |
| Email send | `lib/reports/send.ts` → `sendReport()` |
| Table | `engagement_reports` (migration `supabase/migrations/20260606100000_engagement_reports.sql`) |

**1.1 `/engagements/[id]/weekly-update/new`** — this is a **different, older surface** (see 1.B), *not* part of the pipeline above. There is no `/engagements/[id]/weekly-update` index; the only route is `.../new`.

**1.2 Server action that generates content:** `generateReportAction(engagementId, kind)` in `app/(os)/engagements/[id]/reports/actions.ts:15`, which calls `generateEngagementReport()` in `lib/reports/generate.ts:55`.

**1.3 AI call (the only one in this path):** `lib/reports/narrative.ts`, function `callClaude` (line 79).
- **Model string:** `ANTHROPIC_MODELS.SONNET` = **`claude-sonnet-4-6`** (`lib/anthropic/client.ts:18`). SDK `@anthropic-ai/sdk@0.90.0`. `max_tokens: 2000`.
- **System prompt (verbatim, `narrative.ts:36-60`):**

```
You are writing the prose sections of a professional weekly/monthly consulting status report for a client.

Audience: end client decision-maker. Probably not technical. Wants to know value delivered.

Rules:
- Lead with outcomes, not activities. "Confirmed two pilot firms" not "Held three calls."
- No filler ("synergy", "leverage", "robust", "journey", "exciting"). No corporate empty calories.
- Use commas, full stops, parentheses, colons. Never em dashes.
- Specific over vague. Quantify where possible.
- Past tense for completed work, future tense for next period.
- 2-3 sentence executive summary at the top, written as the consultant signing off.
- Group work by theme, not by day or by task. "Distributor outreach" with the specific things done.
- Hours commentary: factual, no padding. "32 of 40 retainer hours used. 8 in reserve for completion-stage work."
- Don't fabricate. If a task description is vague, summarise faithfully rather than embellish.
- Don't include risks or blockers unless they're real. Empty array is fine.

Return strict JSON matching this schema, and nothing else:
{
  "executive_summary": string,
  "highlights": string[],
  "work_completed": [{ "section_title": string, "items": string[] }],
  "hours_commentary": string,
  "next_period": string[],
  "risks_or_blockers": string[]
}
```

- **Appended at runtime** (`generateNarrative`, `narrative.ts:113-124`): tone note (`consulting` adds nothing; `agency` adds `"\n\nTone: friendly and warm, but still concise."`); a **retainer note** when `included_hours == null` (`"\n\nThis engagement has no retainer. Do NOT mention retainer hours, caps, or reserves in hours_commentary; just state hours worked."`); on a parse miss, a stricter retry instruction.
- **User prompt (verbatim template, `narrative.ts:84` + `buildPayload` line 63):** the user message is `JSON.stringify(buildPayload(data))` — no natural-language wrapper. The payload object is:

```
{
  engagement: <engagement name>,
  client:     <end_client name>,
  period:     { from: <periodStart>, to: <periodEnd> },
  hours:      { total, billable, retainer: { included_hours, used_hours, used_pct } | null },
  completed_tasks: [ { title, detail: <task.description>, project } ],   // query-derived
  time_log:        [ { date, hours, project, task, notes: <entry.description> } ],
  by_project:      [ { name, hours } ]
}
```

**1.4 PDF entry point:** `renderReportPdf(data, narrative, kind)` in `lib/reports/pdf.tsx:167`, using `renderToBuffer` from `@react-pdf/renderer`. Called by `uploadArtifacts()` in `generate.ts:37` and by `rerenderReportPdf()`.

**1.5 Email send entry point:** `sendReport(reportId)` in `lib/reports/send.ts:33`, invoked by `sendReportAction` (`actions.ts:95`). **Send is via Gmail, not Resend** — `sendEmail()` from `@/lib/google/gmail` (see Q6). Requires an explicit human click; never auto-sends.

**1.6 Shareable link / token / expiry:** **The engagement-report pipeline has NO public shareable link.** Delivery is email attachment only, plus admin-only 1-hour signed storage URLs (`signedReportUrl`, `generate.ts:160`, TTL `3600`). The only `/report/[token]` route (`app/(public)/report/[token]/page.tsx`) is the **sell-in/sell-out analytics** share, unrelated to engagements: it reads `report_tokens` (`token`, `workspace_id`, `label`, `expires_at`) via the anon client, then serves workspace analytics via the admin client. Token/expiry defaults live in `supabase/migrations/20260328194500_report_tokens.sql` (`token default replace(gen_random_uuid()::text,'-','')`, `expires_at default now()+interval '30 days'`). **No code anywhere inserts `report_tokens`** — the "share" generator appears unimplemented; only the read path exists.

**1.7 Other report surfaces:**
- **(1.B) Annex A 3.4 weekly update** — `app/(os)/engagements/[id]/weekly-update/new/page.tsx` → `lib/db/engagements.ts` `weeklyClientUpdateData()` → `lib/templates/weeklyUpdate.ts` `renderWeeklyUpdate()` (deterministic Markdown, **no LLM, no PDF**). Sent by `components/os/engagements/WeeklyUpdateClient.tsx` via `POST /api/gmail/send` (`markdownToHtml`), and saved to engagement documents. **Does not touch `engagement_reports`. Duplicates the concept; shares no code with the pipeline.** Notably this surface *does* compute period-scoped facts the main pipeline lacks: tier-1 milestones touched this week, next-7-day tasks, pipeline by stage.
- **(1.C) Internal weekly scan** — `app/(os)/reports/weekly/` → `getInternalWeeklyReport()` in `lib/reports/data.ts:299`. Internal, cross-engagement hours view; **shares `lib/reports/data.ts`** with the pipeline but has its own client, no PDF/send. The pipeline's `weekly_internal` kind exists but is not wired to a generate button in `GenerateReportControls`.
- **(1.D) Analytics "insights" report** — `app/api/insights/report/route.ts` → `lib/insights/{data,narrative,pdf}.tsx` + `app/api/insights/email` (Resend). A separate AI-narrative dashboard report; unrelated to engagements. Mentioned only to disambiguate.

---

## 2. What data currently reaches the report

**2.1 Queries during `gatherReportData` (`lib/reports/data.ts:131`):**

| # | Table | Filters | Date bounds |
|---|---|---|---|
| 1 | `engagements` | `id = engagementId` | none |
| 2 | `time_entries` | `engagement_id =`, `is_running = false` | `entry_date >= periodStart AND <= periodEnd` |
| 3 | `engagement_tasks` | `engagement_id =`, `status = 'done'` | `completed_at >= {periodStart}T00:00:00 AND <= {periodEnd}T23:59:59` |

Select for #2 (`TE_SELECT`, line 123) embeds `person:people(full_name)`, `project:projects(id,name)`, `task:engagement_tasks(id,title)`, and pulls `rate_snapshot`, `billable`, `description`.
Select for #3 embeds `project:projects(name)`, `assignee:people!assignee_person_id(full_name)`, plus `description`, `completed_at`.

**2.2 Is the work list a query or a model blob?** **Both, in sequence, and this is the core weakness.** The *completed-task list* and *time log* are **query-derived** (queries #2/#3). But the **report body's "Work completed" section is authored by the model** — `buildPayload` hands Claude the raw `completed_tasks` + `time_log`, and the narrative's `work_completed[]` sections/items are free prose the model composes (regroups, rephrases, can drop or merge). The PDF renders **only** `narrative.work_completed` (`pdf.tsx:112`), **never the raw task list**. There is no deterministic factual spine; nothing constrains the model to reproduce every completed item exactly.

**2.3 Is a date range applied?** **Yes.** Time entries are bounded by `entry_date`; completed tasks by `completed_at`. It is not all-time.

**2.4 Where do period start/end come from?** From `engagement_reports.period_start/period_end`, set at generation by `defaultPeriod(kind)` (`generate.ts:17`) unless explicit `periodStart/periodEnd` are passed:
- `monthly_client` → **previous** calendar month (`londonMonthRange(-1)`).
- `weekly_client` / `weekly_internal` → **current** week, Mon–Sun (`londonWeekRange(0)`).
Computed in **Europe/London** (`data.ts:11`). Not hardcoded; not derived from engagement start date. `GenerateReportControls` does not pass an explicit period, so the defaults always apply from the UI.

**Coverage gap:** the report only ever includes **completed** tasks + hours. There is **no "in progress"** and **no "scheduled/next period"** task data in `ReportData` at all — `narrative.next_period` is written by the model with no backing query.

---

## 3. `engagement_tasks` schema (CRITICAL)

Source: `supabase/migrations/20260604093000_engagement_tasks.sql` + ALTERs in `20260604097000_project_end_and_link.sql` and `20260605110000_message_tasks.sql`. Full column list:

| Column | Type | Default / notes |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` PK |
| `engagement_id` | uuid | FK → `engagements`, on delete cascade |
| `title` | text | not null |
| `description` | text | nullable — **internal execution notes live here** |
| `status` | `engagement_task_status` (enum) | not null, default `'backlog'` |
| `priority` | `engagement_task_priority` (enum) | not null, default `'normal'` |
| `assignee_person_id` | uuid | FK → `people` |
| `reporter_person_id` | uuid | FK → `people` |
| `due_date` | date | nullable |
| `labels` | `text[]` | not null default `'{}'` |
| `position` | numeric | not null default 0 (float-midpoint reorder) |
| `created_by` | uuid | FK → `auth.users` |
| `created_at` | timestamptz | not null default `now()` |
| `updated_at` | timestamptz | not null default `now()` (trigger-maintained) |
| `completed_at` | timestamptz | nullable — **trigger-managed** (see below) |
| `project_id` | uuid | FK → `projects` (added `20260604097000`) |
| `source_message_id` | uuid | FK → `chat_messages` (added `20260605110000`) |

**3.1 Exact `status` values (case-sensitive).** DB-enforced enum `engagement_task_status` = **`'backlog', 'in_progress', 'review', 'done', 'cancelled'`** (all lowercase). Because it is a Postgres enum, **case drift is impossible** for this column. Live distribution (246 rows): `backlog` 215, `in_progress` 6, `done` 23, `review` 2, `cancelled` 0.
Priority enum `engagement_task_priority` = **`'low', 'normal', 'high', 'urgent'`** (this is the `normal` variant — Kanban `tasks` use `low|medium|high|urgent`; the two must not be conflated).

**3.2 `completed_at`?** **Yes** (see headline). **`started_at`?** **No.** Status-transition timestamp: `completed_at` is auto-set by trigger `engagement_tasks_set_completed_at()` (`...093000.sql:60-73`): `= now()` on entering `done`, `= null` on any status `<> 'done'`. Only the `done` transition is timestamped on the row; it is mutable/reset.

**3.3 Audit/history of status changes?** **Yes.** `engagement_task_activity` (same migration, line 90) is written by AFTER-trigger `log_engagement_task_activity()` (extended in `20260604098000_task_activity_more_kinds.sql`). It records `kind = 'status_changed'` with `payload {from,to}` and `created_at`, plus `assigned`, `due_date_changed`, `priority_changed`, `title_changed`, `description_changed`, `labels`-changed, `created`, `commented`. **Live-confirmed populated** (`status_changed` rows exist). This is the immutable transition history and the correct backfill source for Phase 2.

**3.4 Date fields:** `due_date` (date), `created_at`, `updated_at`, `completed_at` (all timestamptz). **No `start_date`.**

**3.5 `labels` shape:** Postgres **`text[]`** (not jsonb), default `'{}'`. Live: **81 distinct label values**, and they are **internal planning taxonomy** — e.g. `'Sprint M3 — Tech debt and hygiene pass'`, `'Month 3: Documents and Forms Automation'`, `'Phase 2 (Months 7-18): Revenue-Funded Expansion'`, `'MVP Launch Criteria (Definition of Done)'`, plus short codes/tags `regulatory`, `security`, `integration`, `BF-Port`, `Group-C`, `Manual`, `phase-1`, `market-development`. These read as internal roadmap language, **not client-safe** (see Q8).

**3.6 `phase` column?** **No dedicated column.** Phase is **encoded in `labels`** (e.g. `'Phase 2'`, `'Month 3'`, `'Sprint M1'`).

**3.7 Internal-only content columns:** No `prompt_guideline`, no internal-notes column, **no `cost`, `rate`, or `effort/estimate` column** exists on `engagement_tasks`. The only internal-by-nature fields are **`description`** (execution notes), **`labels`** (planning taxonomy), and **`priority`**. (Rates/cost live on `time_entries`, not tasks — see Q8.)

---

## 4. `engagement_reports` schema

Source: `supabase/migrations/20260606100000_engagement_reports.sql`. **Live: 0 rows — the pipeline has never produced a report.**

**4.1 Full columns:** `id` uuid PK; `engagement_id` uuid not null (FK, cascade); `kind` `report_kind`; `period_start` date not null; `period_end` date not null; `status` `report_status` default `'draft'`; `narrative_json` jsonb; `narrative_edited` jsonb; `pdf_storage_path` text; `xlsx_storage_path` text; `total_hours` numeric(8,2); `billable_hours` numeric(8,2); `total_value_gbp` numeric(12,2); `task_count_completed` int; `recipient_emails` text[] not null default `'{}'`; `sent_at` timestamptz; `sent_to_message_id` text (Gmail id); `sent_by` uuid; `created_by` uuid; `created_at` timestamptz; `updated_at` timestamptz. **Unique `(engagement_id, kind, period_start)`.**
Enums: `report_kind = 'weekly_internal','weekly_client','monthly_client'`; `report_status = 'draft','sent','archived'` (lowercase, enum-enforced → no case drift).

**4.2 Period columns:** **Yes** — `period_start` and `period_end` (both `date not null`).

**4.3 Content storage:** **Structured JSONB** — `narrative_json` (LLM output) and `narrative_edited` (user edits; the edited version wins when present, per `send.ts:53` / `actions.ts:41`). Shape = `NarrativeSchema` (`executive_summary`, `highlights[]`, `work_completed[{section_title, items[]}]`, `hours_commentary`, `next_period[]`, `risks_or_blockers[]`). **Not markdown, not HTML.** The rendered PDF/XLSX are binaries in storage, referenced by path.

**4.4 Token / expiry / pdf_url / storage path:** **No token column, no expiry column, no `pdf_url`.** Only `pdf_storage_path` and `xlsx_storage_path` (paths in the private `engagement-reports` bucket, format `{engagementId}/{reportId}/report.pdf|timesheet.xlsx`). Access is via on-demand 1-hour signed URLs (`signedReportUrl`).

**4.5 RLS + public read:** Table policy `engagement_reports_admin` = `FOR ALL USING (is_admin()) WITH CHECK (is_admin())` — **admin-only, no public/anon access.** The storage bucket `engagement-reports` is **private** with `is_admin()` read/write/delete policies on `storage.objects`. **There is no public shareable-link read path for engagement reports** (unlike the analytics `report_tokens` route). A client only ever sees the report as an **email attachment**.

---

## 5. PDF layer

**5.1 Version:** `@react-pdf/renderer` — `package.json` `^4.3.2`; **installed 4.3.2** (confirmed from `node_modules/@react-pdf/renderer/package.json`).

**5.2 Document/Page component tree:** `lib/reports/pdf.tsx` — `ReportDocument` (line 72) → two `<Page size="A4">`: (1) a cover (wordmark, kind chip, engagement name, client, period, billed-via) and (2) narrative + an Hours table (`by_person` + total + billable/value/retainer line) + Next period + Risks. Helpers `Bullets`, `Footer`. (Other PDFs — `lib/pdf/InvoicePDF.tsx`, `QuotePDF.tsx`, `WeeklyReportPDF.tsx`, `lib/insights/pdf.tsx`, `lib/finance/invoice-pdf.tsx` — are unrelated to engagement reports.)

**5.3 Custom fonts?** **No.** No `Font.register` anywhere in `pdf.tsx`. It uses the built-in `Helvetica` / `Helvetica-Bold` PDF standard fonts only.

**5.4 How produced / runtime:** Server-side `renderToBuffer(...)` returning a Node `Buffer`, called inside the server action → `generateEngagementReport` (`generate.ts`). Node runtime (Supabase server client, `Buffer`, storage upload); **not edge, not client-side.**

**5.5 Stored anywhere?** **Yes** — uploaded to the private Supabase Storage bucket **`engagement-reports`** at `{engagementId}/{reportId}/report.pdf` (`generate.ts:22,40`), `upsert: true`. Re-rendered in place on narrative edits (`rerenderReportPdf`).

**5.6 Header/footer/page-number/logo:** A fixed `Footer` (`pdf.tsx:63`) renders `"Trailhead Holdings Ltd · Confidential"` on the left and `"{pageNumber} / {totalPages}"` on the right, with a top border. The masthead is a **typographic wordmark** `TRAILHEAD HOLDINGS` (`styles.wordmark`), repeated on each page. **No logo image is loaded** — the file comment (line 6-7) states the brand kit isn't bundled, so a wordmark is used to avoid a render failure on a missing asset.

---

## 6. Email layer

**6.1 Resend?** **The engagement report does NOT use Resend.** `resend@6.8.0` is installed and used elsewhere (`app/api/enquiries`, `app/api/tasks/email`, `app/api/insights/email`, invoices, invites, `app/api/webhooks/resend`) but **not** for engagement reports. The report is sent through **Gmail** — `sendEmail()` from `lib/google/gmail.ts`, via `sendReport()` (`send.ts:77`). The Annex A weekly-update surface likewise sends via `POST /api/gmail/send`.

**6.2 Shared template component?** **No.** The cover note is an **ad-hoc HTML string** built inline in `sendReport` (`send.ts:68-74`) — `<p>` tags only. The Annex A surface builds its own HTML via `markdownToHtml` (`lib/templates/weeklyUpdate.ts`). No shared email layout component.

**6.3 React components / react-email?** **No.** No `react-email` / `@react-email` dependency. Emails are raw HTML strings. User-supplied fragments are escaped with a local `esc()` (`send.ts:11`).

**6.4 From-address / verified domain:** `lib/google/gmail.ts` `buildRawMessage` sets `To/Cc/Bcc/Subject` headers but **no explicit `From`** and sends with `userId: 'me'`, so Gmail stamps the **authenticated Google account** as sender. Live `google_tokens` holds `rob@trailheadholdings.uk`, so that is the effective from-address. **This is a Gmail send, so Resend domain verification is irrelevant to this path** (no Resend sending domain involved).

**6.5 Emailed or link only?** **Emailed** — PDF + XLSX attached (`send.ts:81-84`); there is no shareable link. Send is gated: admin-only, requires ≥1 recipient explicitly set (`setRecipientsAction`), blocks if already `sent`, and is only invoked from a user click.

**6.6 Email-client safety:** The body is minimal `<p>`-only inline HTML with no `<table>` layout and no inline-CSS styling framework — simple enough to render, but there is **no email-client-safe template system** (no tables, no inlined CSS, no preheader, no dark-mode handling).

---

## 7. Brand assets

**7.1 Logo in repo?** **Yes**, in `public/`: `logo.svg`, `logo-dark.svg`, `logo-icon.svg`, `favicon.svg`, `trailhead-os-google-logo.svg` (plus framework defaults `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). **However, none are used by the report PDF or email** — `pdf.tsx` deliberately uses a text wordmark and loads no image.

**7.2 Design tokens (actual hex, `app/globals.css` `:root`):**
- `--bg #0C0C14` (near-black), `--card #1A1A28`, `--card-alt #13131E`, `--border #2A2A3A`
- **`--lime #B8FF00`** (the app's accent), `--muted #9CA3AF`, `--orange #FF6B35`
- data-viz: `--blue-d #4B9FFF`, `--pink-d #FF4081`, `--purple-d #A78BFA`, `--green-d #34D399`, `--yellow-d #FBBF24`
- Tailwind `@theme` mirrors these as `--color-os-*` (e.g. `--color-os-lime #B8FF00`).
- Base light tokens: `--background #ffffff`, `--foreground #171717`.

**BRAND MISMATCH:** the report PDF hardcodes its **own** palette in `lib/reports/pdf.tsx:8-11` — `INK #1A1A1A`, `MUTED #6B7280`, `LINE #E5E7EB`, **`ACCENT #0F766E` (teal)** on a white page. This is **teal-on-white**, whereas the product brand is **lime `#B8FF00` on near-black `#0C0C14`**. The two do not match, and the PDF accent is a color that appears nowhere in the design tokens.

**7.3 Shared brand constants module (server+client)?** **No single brand-token module.** The closest is `lib/company-settings.ts` (DB-backed company details, server-oriented) and `lib/site.ts` (URL helpers). Color tokens live only in CSS (`app/globals.css`) and are duplicated ad hoc inside each PDF (`pdf.tsx`, `xlsx.ts` uses its own teal `FF0F766E`). There is **no importable TS brand constants module** consumed by both PDF and email — which is exactly what the Phase 2 shape calls for.

**7.4 Company footer details.** Defined in `lib/company-settings.ts` (`DEFAULT_COMPANY_SETTINGS`) and overridable via a `company_settings` DB row:
- `company_name` **"Trailhead Holdings Ltd"**, `company_number` **"16910286"** ("Registered in England & Wales"), `city` **"Brentwood, Essex"**, `country` "United Kingdom", `company_email` **"info@trailheadholdings.uk"**, `vat_registered` **false**, `vat_number` **null** (not VAT-registered), plus bank/payment fields.
- These are rendered by `InvoicePDF.tsx`, `QuotePDF.tsx`, `lib/finance/invoice-pdf.tsx`, and the outreach/company-settings email footers — **but NOT by the engagement report PDF**, which only prints `"Trailhead Holdings Ltd · Confidential"`. Registered-office note: `lib/outreach/footer.ts` documents that the registered office is a home address.

---

## 8. Client-facing leakage audit

Everything the client can see comes from **`ReportData`** (`lib/reports/data.ts`) via three artifacts: the **PDF** (narrative + hours), the **XLSX** (full timesheet), and the **email body**. There is **no client-safe projection layer** — the same object feeds the LLM, the PDF, and the XLSX.

| Field / source | Reaches | Safe? |
|---|---|---|
| `time_entries.rate_snapshot` → XLSX **Rate** column | XLSX (always) | **NO** — internal billing rate, written regardless of `is_billable` |
| per-entry **Value**, By Person value, By Project value | XLSX (when `is_billable`) | **NO/decide** — exposes effective billing math |
| `time_entries.description` → XLSX **Notes** + LLM `time_log.notes` | XLSX (always) + model context | **NO** — internal execution notes; XLSX prints verbatim, model may echo |
| `engagement_tasks.description` → LLM `completed_tasks.detail` | model context | **RISK** — internal task detail; model may surface it in prose |
| `people.full_name` (assignees, by-person hours) | PDF + XLSX | **Decide** — exposes team member identities/staffing |
| `engagement.day_rate`, `retainer_amount_monthly` | loaded into `ReportData`, not currently rendered | latent — one edit from exposure |
| retainer used %, total value | PDF hours line (when billable) | usually intended, but confirm per engagement |
| Annex A workstream / roadmap labels (`engagement_tasks.labels`, 81 values) | **not currently rendered** in the pipeline (PDF shows model prose, not labels) | latent — internal taxonomy (`'Phase 2 (Months 7-18)…'`, `BF-Port`); would leak if labels are ever surfaced or fed to the model |
| Prompt guidelines / internal-notes columns | **do not exist** on `engagement_tasks` | n/a |
| margin / cost / effort columns | **do not exist** | n/a |

**Highest-risk, live today:** the **XLSX Detail sheet** (rates + notes, always; values when billable). Because it is attached to the client email, the leak requires no rendering decision — it ships by default. Task/labels leakage into the LLM is a secondary risk (the model receives raw `description` values and could restate them).

---

## 9. Period data availability beyond tasks

**9.1 `time_entries` aggregation by an arbitrary range, grouped by task labels.** **Yes, achievable, but not currently done by labels.** `time_entries` can be range-filtered on `entry_date` (as the report already does) and joined to `engagement_tasks` via **`time_entries.task_id → engagement_tasks.id`** (the `TE_SELECT` embed `task:engagement_tasks(id,title)` proves the FK). To group by *labels*, extend that embed to select `engagement_tasks.labels` and unnest. **`time_entries.workstream` was dropped** (`20260605130000_remove_engagement_workstreams.sql`, archived to `_archive_time_entries_workstream_2026_06`, only 10 rows ever had a value; the `engagement_workstream_split` view was dropped with it). No live code references `time_entries.workstream`; the report path already groups by project/person, not workstream, so there is **no dangling reference defect** in the report path.

**9.2 `tier1_milestones` gate columns — movement within a period?** **Yes, for "reached in period."** Columns `range_review_decided_at`, `go_live_confirmed_at`, `first_po_received_at` each hold **the date the gate was reached**. `weeklyClientUpdateData` (`lib/db/engagements.ts:262-268`) already detects movement by testing `gateDate ∈ [weekStart, weekEnd]`. Limitation: each is a **single current-state date**, not a history — if a gate is cleared/re-set you lose the prior value, and gates reversed within a period aren't captured. For forward-only gate progression this is sufficient and factual.

**9.3 Calendar events queryable by engagement/account for a range?** **Not directly.** `calendar_events` (`20260329091230_calendar_events.sql`) has `start_at`/`end_at` (range-queryable) and `contact_id` + `workstream_id`, but **no `engagement_id` and no `account_id`**. "Meetings held this period" for an engagement can only be reached indirectly (via `contact_id → contacts.account_id → engagement.end_client_account_id`) and only for events that have a contact. Live: 222 `calendar_events` rows. Separately, **`meetings`** (Granola, 32 live rows) and **`meeting_notes`** (0 live rows) **do** carry `account_id` and dates, so account-scoped meeting facts are more reliably sourced there than from `calendar_events`. None of these are wired into the report today.

**9.4 Risks/issues store on the engagement?** **None exists.** No risks/issues table references `engagements`, and `engagements` has no risks column. Risks are **free text authored by the model** in `narrative.risks_or_blockers[]` (empty array allowed) — there is no factual backing store.

---

## Cross-cutting notes for Phase 2 framing

- The factual spine Phase 2 wants is **partly already available**: completed-in-period (via `completed_at` / activity log), hours used vs included, tier-1 gate dates. **Missing:** in-progress-at-period-end and scheduled-for-next-period (no query today), meetings-held (no engagement link on `calendar_events`), and an immutable completion time (use `engagement_task_activity`, not the mutable `completed_at`).
- The **status enums are DB-enforced and lowercase**, so the "API vs UI case mismatch" bug class flagged in the brief **cannot occur** for `engagement_tasks.status` or `engagement_reports.status`. (The `gatherReportData` query correctly uses lowercase `'done'`.)
- A **client-safe projection layer** and a **shared brand-token module** are both genuinely absent today, matching the Phase 2 plan. The PDF/XLSX palettes are inconsistent (teal `#0F766E` vs `FF0F766E`) and diverge from the product's lime/near-black brand.
- Two parallel engagement report surfaces (Annex A markdown vs the `engagement_reports` LLM pipeline) exist and duplicate intent; Phase 2 should decide whether the deterministic spine replaces/feeds both.

---

*Investigation only. No code, schema, or migration was changed. No fixes proposed beyond the framing notes requested by the brief.*
