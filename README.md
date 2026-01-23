# Rush Analytics

Production-ready, multi-tenant analytics for sell-in and sell-out performance. Built for subscription brands to ingest their own data and replicate the RUSH Sales Model outputs without Google Sheets.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth, RLS)
- Recharts + TanStack Table
- Netlify deployment (SSR)

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
3) Enable magic link auth in Supabase Auth settings.
4) Add the following env vars locally and in Netlify:
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

## Netlify deployment

1) Create a Netlify site from the GitHub repo.
2) Set environment variables (same as local).
3) Netlify picks up `netlify.toml` for build settings.

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
