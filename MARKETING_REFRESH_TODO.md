# Trailhead Holdings marketing site: refresh backlog

Raised 26 July 2026. The marketing tree lives at `app/(marketing)/marketing/` and is served on the non-app host. It has drifted well behind what the businesses actually are.

> **Update 19 August 2026: the track split landed.** The site is now three
> sub-brands on one domain: Trailhead Commercial (`/consulting`), Trailhead
> Studio (`/studio`, moved from `/web-app-design`) and Trailhead Labs
> (`/labs`, replacing `/products`). Items 1–4 below are resolved by it:
> `/engineer-os` and `/mvp-cricket` 301 to the products' own domains,
> `/bright-fire` 301s to `/studio` where the case study lives, MVP Predictor
> has its page at `/labs/mvp-predictor`, and the homepage is a two-door
> router. Items 5 and 6 (the diverged privacy pages and the prospect-data
> section) are **still open** and still block the outreach campaign.

## The headline problem

`grep -ric "engineer os"` and `grep -ric "predictor"` across the whole marketing tree both return **zero**. The site sells a single-tenant field service app called BrightFire and a V1 MVP Cricket, neither of which reflects where those products got to, and it does not mention the predictor business at all.

## 1. BrightFire page is now Engineer OS

`app/(marketing)/marketing/bright-fire/page.tsx` (228 lines)

Currently titled "BrightFire, Field Service Software for SMEs" with feature cards for job scheduling, digital job sheets, offline capability, customer and site records, PWA for field teams, offline-first architecture, configurable workflows, real-time dispatch.

What it should say: BrightFire was the single-tenant original (QT-0002, April 2026). It became **Engineer OS**, a multi-tenant SaaS for UK field service operators of 5 to 100 engineers, sold per-engineer-per-month, live at engineeros.uk with Stripe payments running since the M1 close on 11 June 2026. Positioned against JobLogic, ServiceM8, Jobber and Commusoft.

Decisions needed before rewriting:

- Does the Bright Fire Services case study stay as a named reference customer, or become an anonymised "a fire and security contractor in Essex"?
- Does the page move to `/engineer-os` with a redirect from `/bright-fire`, or does Engineer OS get its own marketing site at engineeros.uk and this page becomes a one-paragraph portfolio card that links out? The second is probably right now that Engineer OS has its own domain and its own marketing tree.
- The route also needs updating in `middleware.ts`, which currently hardcodes `/bright-fire` in `getMarketingRewritePath`.

## 2. MVP Cricket page is V1

`app/(marketing)/marketing/mvp-cricket/page.tsx` (195 lines)

Feature cards: scoring engine, Play-Cricket sync, leaderboards, multi-club support. Copy reads "Built for grassroots cricket clubs that want a better operating..." and closes on "Bring MVP Cricket into your club workflow."

Needs the V2 positioning, feature set and any pricing change. Brookweald CC is the live test environment, so there is a real reference story available if you want one.

## 3. MVP Predictor does not exist on the site

New page needed. From its README: white-label Premier League prediction competitions for clubs, multi-tenant SaaS, clubs pay a flat subscription and entry money never touches the platform. Forked from the `brookweald-predictor` World Cup 2026 app, which is live at bwcc-predictor.uk. Vercel project `mvp-predictor`; mvppredictor.com is not wired yet.

Work involved:

- New route `app/(marketing)/marketing/mvp-predictor/page.tsx`
- Add `/mvp-predictor` to `getMarketingRewritePath` in `middleware.ts`, alongside the existing `/mvp-cricket` and `/bright-fire` entries
- Add a portfolio card on the home page
- Decide whether bwcc-predictor.uk is shown as a live demo or kept private

## 4. Home page portfolio cards

`app/(marketing)/marketing/page.tsx` (962 lines)

Cards currently read: NGP & FMCG Consulting, Bespoke App Development, MVP Cricket, BrightFire, Trailhead OS. Once the above land it should be NGP & FMCG Consulting, Bespoke App Development, MVP Cricket, MVP Predictor, Engineer OS, Trailhead OS. Meta title is "Commercial Strategy & Product Development for NGP, FMCG and SaaS", which still reads correctly.

## 5. Two privacy pages that have diverged

There are two files: `app/(marketing)/privacy/page.tsx` and `app/(marketing)/marketing/privacy/page.tsx`, and `diff` says they differ. `getMarketingRewritePath` returns `/privacy` unchanged, so the first one is what visitors see. Work out whether the second is dead and delete it, or whether it serves a route that matters and sync the two. Two privacy policies saying different things is a genuine liability, not just untidiness.

## 6. Privacy policy content

Fixed on 26 July 2026: the subprocessor table listed "Vercel / Netlify" as the host. Netlify was the original platform before the switch to Vercel, so it is now just Vercel.

Still outstanding on that page:

- "Last updated: March 2026" needs to move once the outreach changes land
- No section covering **prospect data**. The Engineer OS cold campaign relies on legitimate interests over contact details gathered from public sources, so Article 14 information applies and the email footer link to this policy is how it gets discharged. This is a blocker on the first send, not a nice-to-have.

## Suggested order

1. Privacy policy prospect-data section, since it blocks the outreach campaign
2. Resolve the duplicate privacy page
3. MVP Predictor page, since it is purely additive and nothing depends on it
4. MVP Cricket V2 refresh
5. BrightFire to Engineer OS, last because it needs the routing decision first
