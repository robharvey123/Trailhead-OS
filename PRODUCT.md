# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three buyers arrive on one domain, and they do not overlap.

- **Brand owners and founders in nicotine / reduced-risk / FMCG.** Usually a small or mid-size brand with a product that sells in one market and stalls in the next, or a distributor relationship that has gone quiet. They are evaluating whether this person has actually operated in the category or has only read about it. They are buying seniority, and they buy it from a person, not a firm.
- **Owner-operators of UK SMEs running on spreadsheets, WhatsApp and memory.** Fire and security contractors, solicitors, trades, clubs. They know something costs them time; they usually cannot name the fix. They are wary of agencies, offshoring, and hourly estimates that drift.
- **Field-service and club buyers of the Labs products.** They arrive looking for Engineer OS or MVP Cricket and need routing off this domain quickly, not a second sales pitch.

A fourth reader matters commercially: recruiters, partners and prospective clients checking whether Trailhead is a going concern or a CV with a domain attached.

## Product Purpose

Trailhead Holdings Ltd is a UK founder-led holding company operated by one person, Rob Harvey. It sells two distinct services and runs three owned software products:

- **Trailhead Commercial** — commercial strategy for nicotine, reduced-risk and FMCG brands: market entry, route to market, pricing and portfolio, interim commercial leadership.
- **Trailhead Studio** — bespoke software: internal tools, client portals, offline-capable field apps, full product builds, rebuilds of ageing sites.
- **Trailhead Labs** — Engineer OS, MVP Cricket, MVP Predictor. Each has its own domain; this site only routes to them.

Success is a started conversation: an enquiry that arrives already knowing which of the two businesses it wants.

## Positioning

The same operator does both, and each side is evidence for the other. Thirteen years selling in a hard, heavily regulated category, and the software is built by the person who scoped it — no account manager, no junior team, nothing offshored. The clearest single proof: a bespoke build for a fire and security contractor (BrightFire) worked well enough that it was productised into Engineer OS and taken to market.

A neighbouring consultancy cannot truthfully claim the software; a neighbouring dev shop cannot truthfully claim the £1,500-to-£5M-exit operating history.

## Operating Context

- One domain carries three sub-brands. The chrome resolves its identity from the pathname (`lib/marketing/tracks.ts`): wordmark, accent, nav, primary CTA and a quiet cross-track link.
- Buyers cross-check. The track record names real companies with real trading histories precisely so they can be looked up.
- Enquiries arrive through a track-aware contact form; the track determines the lead copy and what is asked.
- Both services start the same way: a conversation, then a written scope with a fixed price before anything is committed. Nothing bills by the hour.
- The marketing site shares a Next.js 16 / React 19 / Tailwind v4 / Supabase codebase with the authenticated Trailhead OS app; the marketing route group is `app/(marketing)`, the shell is `components/marketing/MarketingShell.tsx`. Blog posts come from Supabase.

## Capabilities and Constraints

- Routes in scope: `/`, `/consulting`, `/studio`, `/labs`, `/labs/mvp-predictor`, `/blog`, `/blog/[slug]`, `/contact`, `/privacy`, `/terms`.
- Content is server-rendered. Blog content is Supabase-backed and rendered through `react-markdown`; legal pages are long-form prose.
- Scroll reveal must keep content present in the HTML and only CSS-hidden, with a `<noscript>` override — a JS failure must never leave a crawler a hero and a blank page.
- The site must work with the header nav hidden below `md`, so the footer carries a second full route to every page.
- Terminology to preserve: Trailhead Commercial (not "consulting" as a brand name), Trailhead Studio, Trailhead Labs. "Reduced-risk" and "NGP" are category terms the audience uses.
- Copy is confirmed and stays as written unless Rob changes it. It is the strongest asset the site has.

## Brand Commitments

- **Binding:** the name set (Trailhead Holdings Ltd / Commercial / Studio / Labs) and the bar-chart mark — four ascending rounded bars, the last one carrying the accent.
- **Open for replacement:** the three-track colour system (currently navy `#0B4A6F`, sky `#0EA5E9`, violet `#7C3AED`), the Georgia serif logotype, Inter as the type system, and every layout decision on the current site.
- **Voice, confirmed and binding:** British English, plain, specific, unhedged. It names real companies, real prices and real limits, and it says what it will not do ("we will say so rather than learn on your budget"). No hype, no superlatives, no invented social proof.
- Registered office: Brentwood, Essex. Registered in England & Wales. `info@trailheadholdings.uk`, `+44 7346 808412`.

## Evidence on Hand

Real, in the repo or verifiable:

- Named operating history: Dholakia Tobacco (2024–26), RoarLabs (2023–24), Flonq (2022–23), V&YOU (2020–22), EOS Leisure (2014–20, £1,500 start-up to £5M+ turnover, £4M raised, exit 2019).
- One live client engagement: Qola, UK and EU commercial, Aug 2026 to date, initial term to Nov 2026.
- Two client projects with real detail: Bright Fire Services (live, productised into Engineer OS) and Yasin & Co Solicitors (in build, audit delivered, scope agreed).
- Live products with paying customers and real pricing: Engineer OS (from £15 per engineer per month, engineeros.uk), MVP Cricket (from £19 per month, mvpcricket.app). MVP Predictor is in build.
- Three published blog posts, Supabase-backed.

**Confirmed to exist but not yet located on disk — Rob to supply paths:** photography of Rob, product screenshots (Engineer OS / MVP Cricket / BrightFire), and client or company logos. Until those files land, the design must stand without them and expose them as first-class slots rather than faking them. The current Studio hero fakes a job board in `div`s; that is a placeholder to be replaced with a real screenshot, not a pattern to extend.

**Must never be invented:** testimonials, client quotes, named accounts under negotiation, commercial terms, headcount, awards, benchmark numbers, or any customer not listed above.

## Product Principles

1. **Proof over adjectives.** Every claim on this site is checkable — a company you can look up, a price you can read, a product you can go and buy. The design's job is to make that checkability visible, not to decorate around it.
2. **One operator is the offer, not a limitation.** The person who scopes the work does the work. The site should feel authored by someone, not assembled by a firm.
3. **Two businesses, two buyers, one domain.** A visitor must know within one viewport which door is theirs. The tracks stay distinguishable without fragmenting into two sites.
4. **Say the limits out loud.** The voice earns trust by naming what it will not do and what has not happened yet. Nothing in the design may soften that into brochure language.
5. **Credibility is the failing metric.** The writing already earns trust; the surface currently discounts it. Every design decision is judged on whether a serious buyer believes the page before they finish reading it.

## Accessibility & Inclusion

No user-specific requirement was established beyond ordinary standards. The site must keep: content present in the DOM with motion as enhancement only, a reachable nav on small screens, visible focus states, and colour contrast that survives the accent system.
