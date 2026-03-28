# TASKS.md — Trailhead OS sprint board

> Agent: work through tasks in order, top to bottom within each phase. Check off each task with `[x]` when complete. Do not skip ahead to a later phase without explicit instruction from Rob. Add blockers or notes inline using `> Note:` beneath the relevant task.

**How to update this file**: after completing each task, edit the checkbox from `[ ]` to `[x]` and add a one-line note if anything deviated from the plan.

---

## Phase 1 — Command centre & project boards ✅ COMPLETE

- [x] Migration 1 — core OS tables (workstreams, board_columns, tasks, notes)
- [x] Shared types in `/lib/types.ts`
- [x] Supabase client helpers (server + client)
- [x] DB helper modules (workstreams, tasks, columns)
- [x] API routes — workstreams, tasks CRUD, reorder
- [x] DnD kit installed
- [x] Shared OS components — WorkstreamBadge, PriorityBadge, QuickAddTask, TaskCard, TaskSlideOver, Sidebar
- [x] OS layout with auth protection
- [x] Dashboard — command centre (today's tasks, workstream cards, upcoming)
- [x] Project boards — kanban with drag/drop, slide-over, list view toggle
- [x] Master task list — filterable TanStack Table with bulk actions
- [x] Phase 1 QA — typecheck, lint, build all pass

---

## Phase 2 — CRM, enquiries & discovery form ✅ COMPLETE

- [x] Migration 2 — contacts, enquiries tables, tasks.contact_id added
- [x] Types — Contact, ContactStatus, Enquiry, EnquiryStatus, EnquiryFormState
- [x] Resend client + new-enquiry email template
- [x] POST /api/enquiries — public insert, non-blocking email notification
- [x] GET+PATCH /api/enquiries/[id] — authenticated
- [x] DB helpers — enquiries.ts, contacts.ts
- [x] API routes — contacts CRUD
- [x] Public layout — no auth, minimal wrapper
- [x] Discovery form — 15-step Typeform-style public page
- [x] Enquiries admin — list with status tabs, detail with convert-to-contact flow
- [x] CRM contacts — list, new, detail pages
- [x] Phase 2 QA — typecheck, lint, build all pass

---

## Phase 3 — Analytics migration, invoicing & shareable reports

> Agent: all three workstreams are equal priority. Build in this order for logical dependency reasons — analytics migration first (clears the old route debt), shareable reports second (depends on analytics being at its final path), invoicing third (independent, no blockers).

### 3.1 Analytics migration

- [ ] Create `/supabase/migrations/YYYYMMDDHHMMSS_report_tokens.sql` — see schema below, run it now so the token table is ready when shareable reports are built in 3.2
> Note: Migration file created at `/supabase/migrations/20260328194500_report_tokens.sql`, but `supabase db push` is blocked in this environment because `SUPABASE_ACCESS_TOKEN` is not configured.
- [x] Move analytics pages to new paths:
  - `/app/workspace/[id]/page.tsx` → `/app/(os)/analytics/[workspaceId]/page.tsx`
  - `/app/workspace/[id]/imports/page.tsx` → `/app/(os)/analytics/[workspaceId]/imports/page.tsx`
  - `/app/workspace/[id]/settings/page.tsx` → `/app/(os)/analytics/[workspaceId]/settings/page.tsx`
- [x] Move any associated `loading.tsx` and `error.tsx` files alongside the pages
- [x] Move API routes if any exist under `/app/api/workspace/` → `/app/api/analytics/`
> Note: Added `/api/analytics/*` route handlers for the current workspace APIs and kept the existing `/api/workspace/*` handlers in place as compatibility aliases.
- [x] Add permanent redirects in `next.config.ts` so old URLs don't 404:
  ```typescript
  async redirects() {
    return [
      { source: '/workspace/:id', destination: '/analytics/:id', permanent: true },
      { source: '/workspace/:id/imports', destination: '/analytics/:id/imports', permanent: true },
      { source: '/workspace/:id/settings', destination: '/analytics/:id/settings', permanent: true },
    ]
  }
  ```
- [x] Update Sidebar Analytics link to point to the workspace list under the new path
- [ ] Update any internal `<Link href="/workspace/...">` references throughout the codebase — search for `/workspace/` and replace
> Note: Updated the analytics launcher and migrated settings/navigation references; deeper legacy module routes still point at `/workspace/*` until the wider analytics tree is migrated.
- [ ] Confirm all existing analytics functionality works at the new paths (charts load, imports work, settings save)
> Note: Local `npm run typecheck` passes and `npm run lint` reports only pre-existing warnings, but browser-level verification of charts/imports/settings at `/analytics/*` is still pending.

**Report tokens migration SQL** (run now for use in 3.2):
```sql
create table report_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(24), 'base64url'),
  label text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz default now()
);

alter table report_tokens enable row level security;

create policy "authenticated can manage tokens" on report_tokens
  for all using (auth.role() = 'authenticated');

create policy "public can read token by value" on report_tokens
  for select using (true);
```

### 3.2 Shareable report links

- [ ] Create `/app/api/analytics/[workspaceId]/tokens/route.ts`
  - `GET` — authenticated, returns all tokens for this workspace
  - `POST` — authenticated, creates a new token row, accepts optional `{ label?: string, expires_days?: number }` body (default 30 days). Returns `{ token, url, expires_at }`
- [ ] Create `/app/api/analytics/[workspaceId]/tokens/[tokenId]/route.ts`
  - `DELETE` — authenticated, deletes/revokes the token

- [ ] Add "Share report" button to the analytics workspace page (`/analytics/[workspaceId]`)
  - Opens a modal (not a new page — use a simple dialog or a slide-over)
  - Modal shows: generated shareable URL, expiry date, copy-to-clipboard button, and a list of existing active tokens with a Revoke button per token
  - On first open with no tokens: auto-generate one and show it
  - On copy: button text changes to "Copied!" for 2 seconds
  - Shareable URL format: `https://[app-url]/report/[token]`

- [ ] Create `/app/(public)/report/[token]/page.tsx`
  - No auth required — this is the public-facing view
  - On load: look up token in `report_tokens` table using the anon Supabase client
  - If token not found or `expires_at < now()`: show a clean "This report link has expired or is invalid" page — no error stack, no redirect to login
  - If token valid: fetch workspace data and render a read-only version of the analytics dashboard
  - Read-only means: no imports button, no settings link, no share button, no sidebar
  - Show a small "Powered by Trailhead OS" footer — good for brand visibility
  - The page should look polished — clients will see this

- [ ] Add token management to workspace settings page (`/analytics/[workspaceId]/settings`)
  - Section: "Shareable report links"
  - Table of active tokens: label (if set), created date, expiry date, Revoke button
  - "Create new link" button (with optional label input)

### 3.3 Invoicing

**VAT behaviour**: VAT rate is editable per invoice. Default is 20%. Can be set to 0% to effectively disable VAT (do not add a separate toggle — the rate field handles it). Always show the VAT row in the invoice summary even when rate is 0%.

- [ ] Create `/supabase/migrations/YYYYMMDDHHMMSS_invoices.sql`:

```sql
create sequence invoice_number_seq start 1;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null
    default 'TH-' || lpad(nextval('invoice_number_seq')::text, 4, '0'),
  contact_id uuid references contacts(id) on delete set null,
  workstream_id uuid references workstreams(id) on delete set null,
  status text default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date,
  line_items jsonb not null default '[]',
  -- line_items shape: [{ id: string, description: string, qty: number, unit_price: number }]
  vat_rate numeric not null default 20,
  -- vat_rate is the percentage (e.g. 20 = 20%). Set to 0 for no VAT.
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table invoices enable row level security;
create policy "authenticated full access" on invoices
  for all using (auth.role() = 'authenticated');
```

- [ ] Run migration in Supabase
- [ ] Verify `invoice_number` auto-populates as TH-0001, TH-0002 etc. on insert

- [ ] Add to `/lib/types.ts`:
  - `LineItem` — `{ id: string; description: string; qty: number; unit_price: number }`
  - `Invoice` — all fields, with `line_items: LineItem[]`
  - `InvoiceStatus` — `'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'`
  - `InvoiceTotals` — `{ subtotal: number; vat_amount: number; total: number }` — computed, not stored
  - Helper function `calculateTotals(line_items: LineItem[], vat_rate: number): InvoiceTotals`

- [ ] Create `/lib/db/invoices.ts`:
  - `getInvoices(filters?: { status?: InvoiceStatus; workstream_id?: string })`
  - `getInvoiceById(id: string)`
  - `createInvoice(data: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'>)`
  - `updateInvoice(id: string, data: Partial<Invoice>)`

- [ ] Create `/app/api/invoices/route.ts` — `GET` (filterable list), `POST` (create)
- [ ] Create `/app/api/invoices/[id]/route.ts` — `GET`, `PATCH`
- [ ] Create `/app/api/invoices/[id]/pdf/route.ts` — `GET`, returns PDF buffer with correct headers:
  ```typescript
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
  }
  ```

- [ ] Install PDF library: `npm install @react-pdf/renderer` — check package.json first

- [ ] Create `/lib/pdf/InvoicePDF.tsx` — the React PDF template component. Must include:
  - Header: "Trailhead Holdings Ltd" · Registered in England & Wales · rob@trailheadholdings.com
  - Invoice number, issue date, due date
  - Bill To: contact name and company (if set)
  - Line items table: Description | Qty | Unit price | Line total
  - Subtotal row
  - VAT row: shows rate percentage and amount (e.g. "VAT (20%)  £X.XX") — always shown, even if 0%
  - Total row — bold
  - Payment terms / notes section at the bottom if `invoice.notes` is set
  - Footer: "Trailhead Holdings Ltd · Trailhead OS"
  - Clean, professional layout — think a simple accountant's invoice, not a design showcase

- [ ] Add "Invoicing" nav link to Sidebar under a new "Finance" section

- [ ] Create `/app/(os)/invoicing/page.tsx`
  - Page heading: "Invoicing" with total outstanding amount badge (sum of sent + overdue invoice totals)
  - Status tabs: All | Draft | Sent | Paid | Overdue | Cancelled
  - Table columns: Invoice no., Client, Workstream badge, Issue date, Due date, Total (incl. VAT), Status badge, Actions
  - Actions per row: View, Download PDF
  - "New invoice" button top-right
  - Empty state per tab

- [ ] Create `/app/(os)/invoicing/new/page.tsx`
  - Client selector: searchable dropdown from contacts table. Optional — can be left blank.
  - Workstream selector: dropdown of 5 workstreams
  - Issue date: date picker, defaults to today
  - Due date: date picker, optional
  - VAT rate: number input, defaults to 20, label "VAT rate (%)" — user can type any number (0–100)
  - Line items section:
    - Each row: Description (text input, flex-grow) | Qty (number, min 1, width 80px) | Unit price £ (number, 2dp, width 120px) | Line total (read-only, calculated) | Remove row button
    - "Add line item" button appends a new empty row
    - Minimum 1 line item — validate before save
    - All line item calculations done client-side in real time
  - Invoice summary (below line items, right-aligned):
    - Subtotal: £X.XX
    - VAT (N%): £X.XX
    - **Total: £X.XX** (bold, larger)
  - Notes textarea — optional, appears on the PDF
  - Two save buttons: "Save as draft" and "Mark as sent"
    - "Save as draft": POST to `/api/invoices` with status 'draft', redirect to `/invoicing/[id]`
    - "Mark as sent": POST with status 'sent', redirect to `/invoicing/[id]`

- [ ] Create `/app/(os)/invoicing/[id]/page.tsx`
  - Invoice header: invoice number, status badge, issue date, due date
  - Client and workstream info
  - Line items table (read-only view)
  - Invoice summary: subtotal, VAT (with rate shown), total
  - Notes (if set)
  - Action buttons:
    - "Download PDF" — fetches `/api/invoices/[id]/pdf` and triggers browser download
    - "Edit" — navigates to `/invoicing/[id]/edit` (see below)
    - Status change buttons depending on current status:
      - Draft → "Mark as sent"
      - Sent → "Mark as paid" | "Mark as overdue"
      - Overdue → "Mark as paid"
      - Paid / Cancelled → no status change buttons
    - "Cancel invoice" — available on Draft and Sent. Confirm before acting.

- [ ] Create `/app/(os)/invoicing/[id]/edit/page.tsx`
  - Same layout as `/invoicing/new` but pre-populated with existing invoice data
  - Only allow editing if status = 'draft' — if status is anything else, show a warning banner and redirect to the detail page
  - Save → PATCH `/api/invoices/[id]`, redirect to `/invoicing/[id]`

### 3.4 Phase 3 QA

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — builds without error
- [ ] Analytics: old URLs (`/workspace/[id]`) redirect to new paths (`/analytics/[id]`) — test in browser
- [ ] Analytics: all charts, imports, and settings work at the new paths
- [ ] Shareable report: generate a link, open it in an incognito window — loads without login
- [ ] Shareable report: expire a token (set `expires_at` to past via Supabase dashboard), confirm the public page shows the expired message
- [ ] Shareable report: revoke a token, confirm link no longer works
- [ ] Invoicing: create an invoice — invoice number is TH-0001 (or next in sequence)
- [ ] Invoicing: VAT rate change updates totals in real time on the new invoice form
- [ ] Invoicing: VAT rate 0% — VAT row shows £0.00, total = subtotal
- [ ] Invoicing: PDF downloads with correct totals, client name, line items
- [ ] Invoicing: status transitions work (Draft → Sent → Paid)
- [ ] Invoicing: editing a sent invoice is blocked with a warning

---

## Backlog — not scheduled

- [ ] Daily email digest — today's tasks and overdue items (Resend infrastructure already in place)
- [ ] Calendar view — monthly/weekly task layout by due date
- [ ] eBay/Amazon stock tracker in ecommerce workstream
- [ ] MVP Cricket metrics surfaced in app-dev board
- [ ] Mobile app / PWA
- [ ] Time tracking against tasks for consulting billing
- [ ] Recurring tasks
- [ ] Overdue invoice auto-flag — cron job or Supabase scheduled function to move sent invoices past due date to 'overdue'
- [ ] Client portal — authenticated read-only project view for specific clients

---

## Notes & decisions log

> Agent: add timestamped notes here when you make a significant architectural decision or hit a blocker.

- Phase 1 complete — all went to plan.
- Phase 2 complete — all went to plan, no schema deviations.
- Phase 3 build order: analytics migration → shareable reports → invoicing.
- VAT: editable rate per invoice, defaults to 20%. Rate of 0% = no VAT. No separate toggle — the rate field handles it. VAT row always shown on PDF and summary even when 0%.
