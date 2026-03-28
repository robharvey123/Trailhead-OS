# CLAUDE.md — Trailhead OS

> Agent instructions for evolving `rush-analytics` into **Trailhead OS** — Rob Harvey's personal business operating system built on Next.js, TypeScript, Tailwind, and Supabase.

---

## Project vision

Trailhead OS is a personal Monday.com / Asana replacement that brings every workstream Rob operates under Trailhead Holdings Ltd into one authenticated web app. It is **not** a product sold to end users — it is Rob's internal control centre.

The existing `rush-analytics` codebase is the foundation. Do not throw it away. Evolve it.

The app has two distinct surfaces:

1. **Internal OS** — Rob's private command centre (project boards, tasks, CRM, calendar, notes). Only Rob can log in.
2. **Client-facing views** — Read-only or form-only pages Rob can share with external clients (brand analytics reports, discovery intake forms). No client account needed.

---

## Current codebase state

- **Stack**: Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + RLS) · Recharts · TanStack Table · Netlify deployment
- **Existing features**: Multi-workspace sell-in/sell-out analytics, CSV/XLSX import, workspace settings, customer mappings
- **Repo**: `rush-analytics` — rename mentally to `trailhead-os` throughout. Do not rename the GitHub repo unless Rob explicitly asks.
- **Auth**: Supabase email/password. Rob is the only user. Keep it single-tenant for now — do not engineer for multi-user unless asked.

---

## Architecture overview

```
app/
├── (auth)/                    # Login page — existing
├── (os)/                      # Rob's authenticated OS — wrap with layout
│   ├── dashboard/             # Command centre — PHASE 1
│   ├── projects/              # All workstream boards — PHASE 1
│   │   ├── [workstream]/      # Individual board (kanban + list view)
│   │   └── new/               # Create new workstream
│   ├── tasks/                 # Master to-do list across all projects — PHASE 1
│   ├── crm/                   # Contacts & leads — PHASE 2
│   │   ├── contacts/
│   │   └── [id]/
│   ├── analytics/             # Moved from root — existing rush-analytics UI
│   │   └── [workspaceId]/
│   ├── enquiries/             # Discovery form submissions — PHASE 2
│   │   └── [id]/
│   └── invoicing/             # Quotes & billing — PHASE 3
│
└── (public)/                  # No auth required
    ├── discovery/             # Client intake form — PHASE 2
    └── report/[token]/        # Shareable analytics report — PHASE 3
```

---

## The five workstreams

These are seeded into the database. They are not dynamic — do not build a "create workstream" UI in Phase 1. The five are fixed:

| Slug | Label | Colour token |
|------|-------|-------------|
| `brand-sales` | Brand sales | teal |
| `ecommerce` | eBay & Amazon | amber |
| `app-dev` | App development | purple |
| `mvp-cricket` | MVP Cricket | green |
| `consulting` | Consulting | coral |

Each workstream has a Kanban board with these default columns: **Backlog → In progress → Review → Done**. Columns are customisable per workstream but these are the defaults.

---

## Database schema — run migrations in order

### Migration 1 — core OS tables

```sql
-- Workstreams
create table workstreams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  colour text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Seed the five workstreams
insert into workstreams (slug, label, colour, sort_order) values
  ('brand-sales',  'Brand sales',    'teal',   1),
  ('ecommerce',    'eBay & Amazon',  'amber',  2),
  ('app-dev',      'App development','purple', 3),
  ('mvp-cricket',  'MVP Cricket',    'green',  4),
  ('consulting',   'Consulting',     'coral',  5);

-- Board columns per workstream
create table board_columns (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete cascade,
  label text not null,
  sort_order int default 0
);

-- Seed default columns for each workstream
insert into board_columns (workstream_id, label, sort_order)
select w.id, col.label, col.sort_order
from workstreams w
cross join (values
  ('Backlog', 0), ('In progress', 1), ('Review', 2), ('Done', 3)
) as col(label, sort_order);

-- Tasks / cards
create table tasks (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete cascade,
  column_id uuid references board_columns(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  due_date date,
  is_master_todo boolean default false,  -- surfaces on dashboard master list
  tags text[] default '{}',
  sort_order int default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notes per workstream (or standalone)
create table notes (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  title text,
  body text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS — Rob is the only user, keep it simple
alter table workstreams enable row level security;
alter table board_columns enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;

create policy "authenticated full access" on workstreams for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on board_columns for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on tasks for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on notes for all using (auth.role() = 'authenticated');
```

### Migration 2 — CRM and enquiries (Phase 2)

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete set null,
  name text not null,
  company text,
  email text,
  phone text,
  role text,
  status text default 'lead' check (status in ('lead','active','inactive','archived')),
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  biz_name text,
  contact_name text,
  biz_type text,
  team_size text,
  team_split text,
  top_features text[],
  calendar_detail text,
  forms_detail text,
  devices text[],
  offline_capability text,
  existing_tools text,
  pain_points text,
  timeline text,
  budget text,
  extra text,
  status text default 'new' check (status in ('new','reviewed','converted')),
  converted_contact_id uuid references contacts(id) on delete set null
);

alter table contacts enable row level security;
alter table enquiries enable row level security;
create policy "authenticated full access" on contacts for all using (auth.role() = 'authenticated');
create policy "public can insert enquiries" on enquiries for insert with check (true);
create policy "authenticated can read enquiries" on enquiries for select using (auth.role() = 'authenticated');
create policy "authenticated can update enquiries" on enquiries for update using (auth.role() = 'authenticated');
```

---

## Phase 1 — Command centre & project boards

**Goal**: Rob can open the app and see everything that matters today, plus navigate to any workstream board.

### Files to create

#### `/app/(os)/layout.tsx`
Authenticated shell layout. Sidebar with:
- Trailhead OS logo/wordmark (top left)
- Nav links: Dashboard, Tasks, then the 5 workstream boards each with their colour dot
- Bottom: Analytics (link to existing workspace list), Settings, Sign out
- Sidebar should be collapsible on smaller screens

#### `/app/(os)/dashboard/page.tsx`
The command centre. Three columns on desktop, stacked on mobile:

**Left column — Today's tasks**
- Filtered view of `tasks` where `due_date = today` OR `is_master_todo = true` and not completed
- Quick-add task input (adds to master list, no workstream required)
- Group by workstream with colour-coded badges

**Centre column — Board activity**
- One card per workstream showing: column counts, tasks due this week, last updated
- Clicking a card goes to that workstream board

**Right column — Upcoming & notes**
- Tasks due in the next 7 days
- Last 3 notes updated across all workstreams

#### `/app/(os)/projects/[workstream]/page.tsx`
Kanban board for a single workstream.
- Fetch workstream by slug, fetch its columns and tasks
- Drag-to-reorder columns: use `@dnd-kit/core` and `@dnd-kit/sortable` (install if not present)
- Each card shows: title, priority badge, due date, tags
- Click card to open a slide-over panel (not a new page) with full task detail + notes
- Add card button at the bottom of each column
- List view toggle (table of tasks sorted by priority/due date)

#### `/app/(os)/tasks/page.tsx`
Master to-do list. All tasks across all workstreams in one filterable table.
- Filters: workstream, priority, due date range, is_master_todo
- Sortable columns: title, workstream, priority, due date, created
- Bulk actions: mark complete, change priority, move to workstream
- Use TanStack Table (already in the codebase)

### Shared components to create

```
components/
├── os/
│   ├── Sidebar.tsx           # Main nav sidebar
│   ├── TaskCard.tsx          # Kanban card
│   ├── TaskSlideOver.tsx     # Right-panel task detail
│   ├── QuickAddTask.tsx      # Inline task creation input
│   ├── WorkstreamBadge.tsx   # Colour pill for workstream label
│   └── PriorityBadge.tsx     # Priority indicator
```

### API routes to create

```
app/api/
├── tasks/
│   ├── route.ts              # GET (list with filters), POST (create)
│   └── [id]/
│       └── route.ts          # PATCH (update), DELETE
├── tasks/reorder/
│   └── route.ts              # POST — update sort_order after drag
└── workstreams/
    └── route.ts              # GET — list all with task counts
```

---

## Phase 2 — CRM, enquiries & discovery form

### Files to create

#### `/app/(public)/discovery/page.tsx`
Public-facing client intake form. No auth. Typeform-style step-by-step flow (15 questions — see design notes below). On submit: `POST /api/enquiries`. Show a thank-you screen.

#### `/app/(os)/enquiries/page.tsx`
Table of all enquiry submissions. Columns: business name, contact, submitted, status badge, actions.

#### `/app/(os)/enquiries/[id]/page.tsx`
Full enquiry detail. Renders all answers. Buttons: Mark reviewed, Convert to contact (creates a `contacts` row and links back).

#### `/app/(os)/crm/contacts/page.tsx`
Contact list with search, workstream filter, status filter.

#### `/app/(os)/crm/contacts/[id]/page.tsx`
Contact detail — fields, linked tasks, linked enquiry if converted.

#### `/app/api/enquiries/route.ts`
`POST` — public insert, no auth required. Validate required fields (biz_name, contact_name). Return 201 + id.

### Discovery form questions (in order)

1. Business name (text)
2. Main point of contact — name and role (text)
3. Business type (radio: Construction/Building, Electrical/Plumbing/HVAC, Facilities Management, Fire & Security, Cleaning & Maintenance, Other)
4. Team size (radio: 1–5, 6–15, 16–30, 30+)
5. Team split — field vs office (radio)
6. Most important features (multi-select tags: Shared calendar, Job scheduling, Engineer forms, Project notes, File uploads, Customer records, Task management, Photo uploads, Notifications, Invoicing, Reporting, User roles)
7. Current appointment management (radio)
8. Forms engineers currently complete (textarea)
9. Devices engineers use (multi-select tags: Android phone, iPhone, Android tablet, iPad, Laptop)
10. Signal/offline requirements (radio)
11. Existing tools and software (textarea)
12. Biggest pain point to solve (textarea)
13. Ideal timeline (radio)
14. Rough budget (radio, optional)
15. Anything else (textarea, optional)

---

## Phase 3 — Analytics, invoicing & shareable reports

### Analytics module (migrate existing)
- Move existing analytics routes under `/app/(os)/analytics/`
- Add a "Share report" button that generates a signed token and creates a public URL at `/report/[token]`
- The public report page renders a read-only version of the workspace analytics — no login needed

### Invoicing (basic)
- Simple invoice/quote builder: client name, line items (description, qty, unit price), VAT toggle, due date
- PDF export (use `@react-pdf/renderer`)
- Status: Draft → Sent → Paid
- Link invoices to a contact and/or workstream

---

## Coding conventions

### General
- **TypeScript strict mode** — no `any` types. Define all data shapes in `/lib/types.ts`
- **Server components by default** — only add `'use client'` when you need interactivity or hooks
- **Supabase client pattern**: use `/lib/supabase/server.ts` for server components, `/lib/supabase/client.ts` for client components. Follow the existing pattern in the repo.
- **Error handling**: all API routes return `{ error: string }` on failure with appropriate HTTP status codes
- **Loading states**: every async page gets a `loading.tsx` sibling using Tailwind skeleton classes

### File naming
- Pages: `page.tsx`
- Layouts: `layout.tsx`
- Server actions: `actions.ts` co-located with the page
- API routes: `route.ts`
- Components: PascalCase, e.g. `TaskCard.tsx`
- Utilities: camelCase, e.g. `formatDate.ts`

### Styling
- Tailwind only — no inline styles, no CSS modules
- Use existing Tailwind config. Do not add new plugins without asking.
- Dark mode: use `dark:` variants. The app should look good in both.
- Responsive: mobile-first. Sidebar collapses to bottom nav on mobile.

### Supabase
- All DB queries go through the Supabase client — no raw SQL in components
- Use RLS. Every table must have policies.
- Migrations go in `/supabase/migrations/` following the existing naming pattern: `YYYYMMDDHHMMSS_description.sql`

### Drag and drop (Phase 1 kanban)
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Use `DndContext` + `SortableContext` + `useSortable`. Persist order on `dragEnd` via `POST /api/tasks/reorder`.

---

## Existing routes to preserve

Do not break these:

- `/workspace/[id]` — existing analytics dashboard
- `/workspace/[id]/imports` — CSV/XLSX upload
- `/workspace/[id]/settings` — workspace config
- `/api/imports/*` — import processing

These move to `/app/(os)/analytics/[workspaceId]/` in Phase 3. Until then leave them at their current paths.

---

## Environment variables

No new env vars needed for Phase 1 or 2. All Supabase keys are already configured. If adding email (for enquiry notifications), use:

```
RESEND_API_KEY=        # Only if Rob wants email notifications on new enquiries
NOTIFICATION_EMAIL=    # Rob's email address for enquiry alerts
```

---

## Do not build (unless asked)

- Multi-user / team accounts
- Public sign-up
- Stripe / payments
- Mobile app
- Anything requiring a new third-party paid service

---

## How to work

1. **Always read this file first** before starting any task
2. **Ask before creating new dependencies** — check if something in the existing `package.json` already covers the need
3. **Run `npm run typecheck` and `npm run lint`** before declaring a task done
4. **Write migrations before touching components** — schema first, UI second
5. **One phase at a time** — complete Phase 1 before starting Phase 2 unless Rob asks otherwise
6. When in doubt about a design decision, **do the simpler thing** and flag the alternative

---

## Rob's context (read but don't reference directly in UI)

- Operating as **Trailhead Holdings Ltd** — UK registered company
- Five active workstreams: DRIVER caffeine pouches (brand sales), Momentum Commercial (eBay/Amazon catering disposables), client app development, MVP Cricket SaaS, and general NGP/FMCG consulting
- Primary user is Rob Harvey, based in Belper, DE56
- Brookweald Cricket Club is both a committee role and the live test environment for MVP Cricket
- Perry McCarthy is a figurehead/investor contact for DRIVER
- UDL (United Disposables Ltd, Brentwood) is the supplier for Momentum Commercial
