---
name: Trailhead Holdings — Marketing Surface
description: Navy and brand blue from the brand guidelines, Georgia display over Inter, with the logo's four ascending bars as the signature.
scope: app/(marketing) only, scoped in CSS by .bay-plan. The authenticated Trailhead OS app under app/(os) and app/(app) uses a separate dark system and inherits none of these tokens.
source: Trailhead_Brand_Guidelines_v1.0 (May 2026)
colors:
  navy: "#0f172a"
  navy-deep: "#0b1120"
  blue: "#0ea5e9"
  blue-bright: "#38bdf8"
  blue-ink: "#0369a1"
  slate: "#64748b"
  orange: "#f97316"
  ground: "#ffffff"
  cool-light: "#f8fafc"
  border: "#e2e8f0"
  body: "#334155"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.5rem, 5.4vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.016em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.5vw, 1.3rem)"
    fontWeight: 650
    lineHeight: 1.25
  lede:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.45vw, 1.3rem)"
    lineHeight: 1.6
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    lineHeight: 1.7
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.09em"
    textTransform: uppercase
rounded:
  card: "1.25rem"
  small: "0.875rem"
  pill: "999px"
spacing:
  page-max: "72rem"
  section: "3.5rem to 5rem"
  card-gap: "1.25rem"
---

# Design System: Trailhead Holdings — Marketing Surface

The marketing site follows **Trailhead Brand Guidelines v1.0**. This file records how those guidelines are applied on the web. Where the two disagree, the guidelines win.

All of it lives in `app/(marketing)/bay.css`, scoped under `.bay-plan`, plus the chrome in `components/marketing/MarketingShell.tsx`.

## Overview

Primary navy and brand blue carry the identity. Dark navy bands open and close each page; the content between them sits on white and cool light. Georgia sets display headings, Inter sets everything else.

The signature is the logo mark: four ascending bars, the tallest in brand blue, drawn large and quiet in the corner of every full-width navy band. Nothing else on the site is decorative.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--navy` | `#0f172a` | Headings, dark bands, logo bars |
| `--navy-deep` | `#0b1120` | Far edge of the dark bands, header |
| `--blue` | `#0ea5e9` | Buttons, heading rules, active nav, the tallest bar |
| `--blue-bright` | `#38bdf8` | Blue on navy |
| `--blue-ink` | `#0369a1` | Blue as small text on white (5.9:1) |
| `--slate` | `#64748b` | Captions, labels, sub-lines |
| `--orange` | `#f97316` | The hero eyebrow, once per page |
| `--plan` | `#ffffff` | Default ground |
| `--plan-recess` | `#f8fafc` | Alternate sections |
| `--hair` | `#e2e8f0` | Borders and dividers |

Rules:

- **Orange once.** It appears as the hero eyebrow and nowhere else on the page.
- **Brand blue is never body text on white.** It is 3:1. Use `--blue-ink` for small blue text, `--blue` for fills and rules.
- **Buttons are brand blue with navy type** (7.6:1). There is one filled button style.
- **No per-business colours.** Commercial, Studio and Labs all use the same palette.
- **Dark bands remap the working tokens.** `.th-hero`, `.brand-block` and `.th-dark` redefine `--ink`, `--ink-2`, `--ink-3`, `--hair` and `--card`, so the same markup reads correctly on either ground. Do not hard-code light or dark colours inside them.

Status pills (`.key-live`, `.key-build`, `.key-illustrative`) use green, amber and slate. They are state, not brand, and stay small.

## Typography

- **Display and section headings:** Georgia bold. It is a system face, so nothing loads.
- **Everything else:** Inter, already provided by the root layout as `--font-inter`.
- **Numbers:** Inter with tabular figures. Never Georgia for figures in tables.
- **Section headings carry a brand-blue rule** beneath them (`h2.plan-h2::after`).
- Labels are Inter 600, uppercase, lightly tracked. They are used for small metadata, not as kickers above every heading.

## Layout

- One centred column, `72rem` max, `1.25rem` side padding on phones and `2rem` from tablet up.
- Sections alternate white and cool light, divided by a `--hair` rule.
- The hero and the closing band are full-width navy. On the homepage the two business cards overlap the foot of the hero.

## Components

| Class | What it is |
| --- | --- |
| `.th-hero` | The navy page hero: blue glow, fine grid, the bars, staggered rise on load |
| `.th-eyebrow` | The orange hero eyebrow |
| `.facings` / `.facing` | Card grid and card: white, `1.25rem` radius, hairline border, lift on hover |
| `.ticket` | A small panel; inside a card it becomes the card's footer |
| `.flash` | Primary button: brand-blue pill, navy type |
| `.flash-ghost` | Secondary button: outlined pill |
| `.brand-block` | Navy band (closing call to action), or a navy card inside a light section |
| `.key-state` | Status pill |
| `.marketing-prose` | Long-form copy: Georgia headings, navy-header tables per the guidelines |

The class names predate this system (they come from the earlier "bay plan" design). They are kept so the pages did not need rewriting. `.bay-code` gutter annotations are hidden, except in the hero, where the note becomes the eyebrow.

## Motion

One authored moment: the hero rises into place in sequence on load. Section headings rise as they scroll in. Cards lift on hover. Content is never shipped hidden, and `prefers-reduced-motion` turns all of it off.

## Logo

The header and footer use the reverse lockup on navy, drawn exactly as the guidelines specify: three `#F1F5F9` bars, the tallest in `#0EA5E9`, "Trailhead" in Georgia bold at -0.5 tracking, "HOLDINGS LTD" in Georgia regular at +1.5 tracking in `#94A3B8`. Do not recolour the bars or reset the wordmark.

## Do

- Lead with navy and white; let blue be the accent.
- Keep one filled button style.
- Use real screenshots and photographs in `PlateSlot`; it renders nothing without a source.

## Don't

- Add a second accent colour, or use orange more than once on a page.
- Set body copy in brand blue on white.
- Pair Georgia with another serif.
- Use em dashes in copy.
