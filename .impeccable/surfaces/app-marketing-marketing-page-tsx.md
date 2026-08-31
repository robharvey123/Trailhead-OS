---
version: 1
slug: "app-marketing-marketing-page-tsx"
primary_target: "app/(marketing)/marketing/page.tsx"
related_targets: ["app/(marketing)/marketing/consulting/page.tsx","app/(marketing)/marketing/studio/page.tsx","app/(marketing)/marketing/labs/page.tsx","app/(marketing)/contact/page.tsx"]
---

# Surface brief — the public marketing site

## Scope and mode

`app/(marketing)`: `/`, `/consulting`, `/studio`, `/labs`, `/labs/mvp-predictor`, `/blog`, `/blog/[slug]`, `/contact`, `/privacy`, `/terms`.

**Persuade**, with two exceptions that keep their own register: `/blog` and `/blog/[slug]` are **Read**, and the legal pages are Read at their narrowest — one measure, ruled headings, nothing competing.

## Audience and job

Three non-overlapping buyers on one domain, routed by the two doors on the homepage and by the track the chrome resolves from the pathname:

- **Commercial** — a brand owner or founder in nicotine / reduced-risk / FMCG, deciding whether this person has actually operated in the category. Buys seniority, from a person.
- **Studio** — a UK owner-operator running on spreadsheets, WhatsApp and memory. Wary of agencies, offshoring and hourly estimates that drift.
- **Labs** — a field-service or club buyer who needs routing off this domain fast, not a second pitch.

The action, for all three, is starting a conversation that arrives already sorted into the right track.

## Proof this surface runs on

Named companies with real trading histories, one live engagement (Qola), two client projects with real detail, two products with real published prices, three blog posts. Everything is checkable — that is the point of listing it. Nothing beyond this list may be invented: no testimonials, no client quotes, no named accounts under negotiation, no headcount, no benchmarks.

## Constraints

- Copy is confirmed and stays as written; ask before changing a factual line or adding a claim.
- Content must be present in the DOM with motion as enhancement only — a blocked chunk or a crawler that runs no JS must still see the whole page.
- The header nav is hidden below `md`, so the footer carries a second full route to every page.
- The surface shares a codebase with the authenticated OS app. Everything here is scoped under `.bay-plan`; nothing may leak.

## Chosen direction

**The Bay Plan** (seed `19e1c14f`, assigned candidate 6 of 7). The category manager's planogram: every service, role, project and product is a facing registered on a ruled rail, with a shelf-edge ticket underneath carrying the checkable fact. Colour is keyed data, never decoration — the two doors are brand blocks, and signal red is reserved for the price flash on primary actions.

The direction was raised on six named lines taken from the challengers it beat: direction of travel, history in the material, artifact before claim, one type family, epistemic state as material, and nothing floats.

Its honest risk, still live: colour-as-data at page scale is unforgiving. If the ratio drifts — more saturated blocks per screen, red used for anything but an action — the bay reads as supermarket promo rather than category plan, which would undo the exact credibility the redesign exists to restore. Stock and rule must keep carrying the page.

## Memorable moment

The two doors standing as adjacent brand blocks in one bay, each closed by a white shelf-edge ticket with the price flash printed on it — which is both where a flash belongs physically and the only place red stays legible against chrome yellow.

Second: the track record drawn as an elevation, where tenure is the bar's width to scale and past roles draw hollow, so the shape of thirteen years is legible before a word is read.

## Unresolved

- **Real assets are missing.** Photography of Rob, product screenshots (Engineer OS, MVP Cricket, BrightFire) and client logos are confirmed to exist but were not on disk. The build ships imagery-free rather than faking any of it. See `.impeccable/ASSETS.md` for what goes where.
- The Studio hero's job docket is an authored drawing keyed `ILLUSTRATIVE`, not a screenshot. It is a placeholder for a real Engineer OS capture, and it must never be relabelled as one.
