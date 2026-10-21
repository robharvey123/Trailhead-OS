# Rush Analytics

Production-ready, multi-tenant analytics for sell-in and sell-out performance. Built for subscription brands to ingest their own data and replicate the RUSH Sales Model outputs without Google Sheets.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth, RLS)
- Recharts + TanStack Table
- Vercel deployment (SSR)

## Local development

1) Install dependencies

```bash
npm install
```

2) Create your env file

```bash
cp .env.example .env.local
```

Populate `.env.local` with your Supabase project keys.

3) Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Supabase setup

1) Create a Supabase project.
2) Run the SQL migrations from `supabase/migrations` in order.
3) Enable email/password auth in Supabase Auth settings (and disable magic links if not needed).
4) Add the following env vars locally and in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Seed data

```bash
SEED_USER_EMAIL=demo@rushanalytics.local npm run seed
```

This script creates a demo user, workspace, mappings, and sample sell-in/out rows. It requires the service role key.

## Imports

Navigate to `/workspace/:id/imports` and upload CSV or XLSX files.

- Sell In columns: `customer, country, brand, product, date, qty_cans, unit_price, total, promo_cans`
- Sell Out columns: `company, brand, product, month, units, platform, region`

Templates are available via the “Download template” buttons on the Imports page.

## Settings & mappings

Open `/workspace/:id/settings` to configure:

- Brand filter
- COGS %
- Promo cost
- Currency symbol
- Customer mapping rules (including optional group names)

## Analytics computations

- SQL rollups live in `supabase/migrations/*_analytics_views.sql`.
- Pivoting and grouping (per workspace and filter set) are completed server-side in Next.js pages.

## Vercel deployment

1) Import the GitHub repo as a Vercel project (framework preset: Next.js).
2) Set environment variables (same as local) in the Vercel project settings.
3) Cron schedules are read from `vercel.json`; pushes to `main` deploy automatically.

## CTPS screening

A number may only be phoned when it was screened against TPS/CTPS in the last 28 days and is clear (PECR reg 21). The rule lives in the view `contact_call_eligibility`; screening is automatic through the Data Soap validation API (`lib/ctps/datasoap.ts`, `lib/ctps/screen.ts`).

- **Nightly**: `/api/cron/ctps-screen` runs at 04:30 UTC and screens up to 500 contacts from `contacts_needing_ctps` (has a phone, not `do_not_call`, never screened or screened over 28 days ago), never-screened first. Each distinct number is looked up once per run.
- **On creation**: the MCP `create_contact` tool and CSV import (`/api/contacts/import`) screen new numbers straight away. Imported rows that already carry `ctps_checked_at` are left as they are. `update_contact` re-screens a changed phone.
- **Phone changes**: the trigger `trg_contacts_phone_change_resets_ctps` nulls `ctps_registered`/`ctps_checked_at` whenever `phone` changes, so a new number is unscreened (uncallable) until it is checked.
- **Manual**: "Screen now" on Outreach, Call queue (admin only, `POST /api/outreach/ctps/screen`).
- **Failures** leave the contact unscreened, which is the safe state; the next nightly run retries it.
- **Audit**: every paid lookup (and every failed one) is a row in `ctps_checks` (service role only): raw and normalised number, `tps`, `ctps`, credits, error code, source, timestamp. This is the PECR evidence.
- **Credits**: the sales dashboard (`sales_dashboard` MCP tool) shows `datasoapTpsCredits` and `lastScreenRunAt`. If a run hits Data Soap -98 (no credit) or the token/account is rejected, the run stops and an email goes to `NOTIFICATION_EMAIL`. Top up TPS credits in the Data Soap account; the next nightly run carries on. To run it straight away: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/ctps-screen`.
- **Sales seat**: `contacts_sales_guard` stops the seat changing `ctps_*`, `phone` or `email`, or clearing `do_not_call`. It can set `do_not_call`. It cannot trigger screening.
- **Env**: `DATASOAP_API_TOKEN` (required), `DATASOAP_API_URL` (default `https://api.datasoap.co.uk/v2`), `DATASOAP_LOOKUP_PATH` (default empty: the lookup is `POST /v2`).

## Conventional commits

Use Conventional Commits for all changes:

- `feat: add import validation`
- `fix: handle empty sell-out uploads`
- `chore: update docs`

## GitHub flow

- Branch naming: `feature/*`, `fix/*`, `chore/*`
- Open a PR to `main` for review

### PR checklist

- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build passes (`npm run build`)
- [ ] Screenshots for UI changes
- [ ] Supabase migrations reviewed (if applicable)

## Run CI locally

```bash
npm run typecheck
npm run lint
npm run build
```
