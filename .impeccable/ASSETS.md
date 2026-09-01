# Assets — all supplied, 1 September 2026

Nothing on the site is waiting on an asset any more, and nothing is faking one.
Kept as the record of what went where, and of the one placement that changed
once the photograph was actually in hand.

The bay-plan redesign ships imagery-free on purpose: you confirmed photography,
product screenshots and client logos exist, but none were on disk, and the build
fakes nothing. Everything below is a real slot the design is already shaped for.
Drop the files in and wire them at the noted place.

Nothing here is required for the site to be correct today. Each one is a
credibility upgrade, listed in the order it pays back.

---

## 1. Portrait of Rob — SUPPLIED, in the /consulting hero

Placed in the hero's right column, not between the dimension rail and the
Services bay as originally specified below. With the photograph in hand that
plan was wrong: it buried the person halfway down a page whose opening line is
the claim they evidence. The shelf-edge ticket beneath carries the name, the
role, and the "no account manager, no junior team" line lifted out of the FAQ.
File: `public/rob-harvey.webp`, 1066x1600.

### Original specification, kept for the record

**Why it matters most.** The whole pitch is "one operator, not an agency", and
the site currently asserts that in words alone. A face is the cheapest proof
that a person is behind this, and it is the one thing a competitor agency
cannot copy.

- **Where:** `/consulting`, between the dimension rail and the Services bay — a
  full-height plate in the gutter-plus-one-column width, with a shelf-edge
  ticket beneath carrying name, role and the "no account manager, no junior
  team" line that currently lives in the FAQ.
- **Format:** portrait crop, at least 1200 × 1600, plus a 2× variant. Working,
  not corporate — at a desk, on a stand, in a warehouse. Flat, even light suits
  the plan-stock ground; a studio white-background headshot will fight it.
- **File:** `public/rob-harvey.jpg` (+ `rob-harvey@2x.jpg`).

## 2. Product screenshots — SUPPLIED, 1 Sept 2026

Engineer OS, MVP Cricket, Wild 'n' Fresh and Brookweald are all in and live.
What remains open is noted at the end of this section.

- **Engineer OS** — the job board or a completed job sheet. Replaces the
  `JobDocket` component in `app/(marketing)/marketing/studio/page.tsx`. When it
  lands, delete the `ILLUSTRATIVE` key with it; a real capture must never carry
  a label that says it is a drawing, and the drawing must never lose the label.
- **MVP Cricket** — a leaderboard or the MVP scoring view.
- **MVP Predictor** — only once it has a real screen. It is keyed `In build`;
  leave it text-only until then.
- **Format:** 1600 × 1000 or wider, real data (obfuscate names if needed), no
  device mockup frame — the ticket around it is the frame.
- **Files:** `public/labs/engineer-os.png`, `public/labs/mvp-cricket.png`.
- **Where in the design:** each Labs facing gets the image above its ticket, at
  the facing's full width, with a 1px ink rule and no radius.

## 3. Client and company logos

**Why it matters.** The track record tells visitors to look these companies up.
A logo rail makes the looking-up unnecessary for the ones they already know.

- **Needed:** Qola, Dholakia Tobacco, RoarLabs, Flonq, V&YOU, EOS Leisure,
  Yasin & Co Solicitors, Bright Fire Services.
- **Format:** SVG, single colour, transparent — they will be rendered in `--ink`
  at a uniform cap height so they read as one set rather than eight brands
  competing. Full-colour logos will break the keyed-colour discipline.
- **Where:** a logo rail directly under the Track record elevation on
  `/consulting`, and the sector chip on each Studio project.
- **Check first:** these are third-party marks. Use them only where the
  relationship is real and you are comfortable naming it publicly — which is
  already true of everything currently on the page in text.

---

## Two things deliberately not on this list

- **Stock photography.** The world is built to work without it. Dropping stock
  imagery into a plan-stock-and-rule page would read as filler and cost more
  credibility than the empty space does.
- **An office or team photo.** There is no office and no team. The site's voice
  is unusually honest about exactly this, and an implied team would be the one
  claim on the page that is not checkable.
