---
name: Trailhead Holdings — Marketing Surface
description: Navy and brand blue from the brand guidelines, Georgia display over Inter, with the logo's four ascending bars as the signature.
scope: The marketing site under app/(marketing), scoped in CSS by .bay-plan, and the authenticated Trailhead OS under app/(os), scoped by .thmock. Both follow the same guidelines. The OS rules are in the "OS surface" section at the end.
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

## OS surface

The authenticated app (`app/(os)`, `app/(sales)`, login and auth pages) follows the same guidelines as the site. Its tokens live in `app/globals.css` under `.thmock`. The class name predates the brand work and is kept because several hundred files reference it. The shell root (`components/os/OsShell.tsx`) carries `.thmock`, so every OS page and the sidebar read the tokens.

### Colour

| Token | Value | Use in the OS |
| --- | --- | --- |
| `--navy` | `#0F172A` | Sidebar and login ground, headings, primary type, type on blue buttons |
| `--navy-deep` | `#0B1120` | The sidebar's far edge |
| `--blue` | `#0EA5E9` | The one accent: primary button fill, active nav marker, progress bars |
| `--blue-bright` | `#38BDF8` | Blue as type or icon on navy, primary button hover, focus ring on navy |
| `--blue-ink` | `#0369A1` | Blue as type on white: links, active tab label and rule, focus ring on white |
| `--slate` | `#64748B` | Captions on white only |
| `--orange` | `#F97316` | Once per screen: the dashboard "needs attention" count, as a filled badge with navy type |

Components do not read the brand tokens directly. They read the working tokens, which point at them:

| Working token | Light value | Use |
| --- | --- | --- |
| `--bg` | white | Cards, panels, inputs on white |
| `--surface` | `#F8FAFC` | Page ground behind white cards, table header strips |
| `--surface-2`, `--surface-3` | `#F1F5F9`, `#E2E8F0` | Wells, hover grounds, neutral chips |
| `--border`, `--border-light` | `#E2E8F0`, `#CBD5E1` | Hairlines, control borders |
| `--text`, `--text-2`, `--text-3` | navy, `#334155`, `#5B6B82` | Headings, body, captions and labels |
| `--accent`, `--accent-strong`, `--accent-dim` | blue, blue ink, `#E0F2FE` | Fills, blue type on white, tinted grounds |
| `--focus` | blue ink | Focus rings |

Status colours (`--green`, `--amber`, `--red`, `--emerald`, `--grey`, each with a `-dim` ground and a `-strong` type colour) are data, not brand. Use the `-strong` colour for type on its `-dim` ground. Workstream colours are data too and come from one map, `WORKSTREAM_COLOURS` in `lib/workstreams.ts`. That file is the only place those hex values appear.

**Navy surfaces.** `.th-dark` remaps the working tokens for a navy ground, the same way the marketing dark bands do. The sidebar and the login ground use it, so the same markup reads correctly on either ground. `.th-light` opts a white card back in when it sits on navy.

Measured contrast for the pairs the OS uses:

| Pair | Ratio |
| --- | ---: |
| Navy type on a brand-blue button | 6.44:1 |
| Navy type on the blue-bright hover | 8.33:1 |
| Blue ink on white, on cool light | 5.93:1, 5.67:1 |
| Body `#334155` on white | 10.35:1 |
| `--text-3` on white, on `--surface`, on `--surface-2` | 5.43:1, 5.19:1, 4.95:1 |
| Slate on white | 4.76:1 |
| Nav type `#CBD5E1` on navy | 12.02:1 |
| Nav icons and group headers `#94A3B8` on navy | 6.96:1 |
| White type on the active nav row | 14.46:1 |
| Blue-bright icon on the active nav row | 6.75:1 |
| Brand-blue bar on navy | 6.44:1 |
| Navy type on a brand-blue badge, on the orange badge | 6.44:1, 6.37:1 |
| Focus ring: blue ink on white, blue bright on navy | 5.93:1, 8.33:1 |

Three pairs fail and are never used: white type on brand blue (2.77:1), brand blue as an indicator on white (2.77:1), and orange as type on white (2.80:1).

### Type

- **Georgia** sets page titles and section titles only.
- **Inter** sets everything else, including every figure. The OS root sets `font-variant-numeric: tabular-nums`.
- **Figures are never Georgia.** Stat values are Inter 600 (`.stat-value`).
- **Labels** are Inter 600, uppercase, `0.75rem`, `0.09em` tracking: column headers, eyebrows, field labels, stat captions. Classes: `.os-label`, `.os-eyebrow`, `.field-label`, `.meta-label`, `.stat-label`.
- **JetBrains Mono is for codes only**: engagement codes (`QOLA-UKEU-26`), invoice and quote numbers (`TH-0028`), ids, keyboard hints. Classes: `.os-mono`, `.td-mono`. Dates, money, durations, counts and labels are Inter; secondary table cells use `.td-num`.

### Shape and depth

Three radii, and nothing else:

| Token | Value | Class | Use |
| --- | --- | --- | --- |
| `--radius-control` | 8px | `rounded-control` | Inputs, selects, small buttons, table chips |
| `--radius-card` | 14px | `rounded-card` | Cards, panels, modals, sidebar nav rows |
| `--radius-pill` | 999px | `rounded-pill` | Buttons, status badges, filter chips, dots and avatars |

Two shadows: `--shadow-sm` for cards at rest, `--shadow-lg` for overlays. Write them as `shadow-[var(--shadow-sm)]` and `shadow-[var(--shadow-lg)]`. No coloured glows.

### Primitives

All in `components/ui/`.

| Component | What it is |
| --- | --- |
| `Button` | `variant`: `primary` (brand-blue pill, navy type), `secondary` (white pill, 1px border), `ghost` (text only), `danger` (red type and border; `danger-solid` only for the confirming action in a confirm dialog). `size`: `sm`, `md`. Pass `href` to render a link. |
| `PageHeader` | `title`, plus optional `eyebrow`, `count`, `description`, `actions`, `tabs`, `back`. One Georgia title at 26px (22px below `md`). Every OS page renders its header through it. |
| `Card` | White card: 14px radius, hairline border, resting shadow. |
| `StatCard` | A figure with its label and an optional sub-line. |
| `Badge` | Status pill, `tone`: `accent`, `green`, `amber`, `red`, `emerald`, `grey`. |
| `EmptyState` | A title, one line, one action. |

The button look lives in CSS (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-text`, `.btn-danger`, `.btn-sm`), and `Button` renders those classes. Older call sites write the classes directly; `.btn-ghost` is the older name for secondary. New code uses the component.

The logo is `components/brand/TrailheadLogo.tsx` (`variant`: `reverse` or `positive`; `markOnly`). The sidebar carries the reverse lockup on navy, mark only when collapsed.

Content width: list and board pages run full width inside the shell's padding. Forms and settings use `.os-narrow` (880px). Nothing else.

### How the OS classes and Tailwind utilities interact

The OS component classes in `app/globals.css` (`.btn`, `.os-card`, `.td-num`, `.stat-value`, `.field-label` and the rest) are not in a cascade layer. Tailwind utilities are. An unlayered rule beats a layered one, so on an element that carries one of these classes, a utility for a property the class already sets does nothing.

- On a `btn`, layout utilities work (`w-full`, `mt-4`, `ml-auto`). Padding, radius, colour and `hidden` do not. Put a responsive `hidden` on a wrapper.
- To override a class property on purpose, use the important modifier with a trailing `!`, for example `text-right!` on a `.data-table` header cell.
- Three things sit in the components layer so utilities can override them: the default padding and size of `.os-input`, `.os-select` and `.os-textarea`, and the ground and minimum height of `.thmock` itself.

Moving all the component classes into `@layer components` would remove the need for the important modifier. It changes which rule wins on every element that mixes the two, so it is its own piece of work.

### Do

- Read working tokens: `bg-[var(--surface)]`, `text-[var(--text-2)]`, `border-[var(--border)]`.
- Give a screen one primary button. Everything else is secondary or ghost.
- Use blue ink, not brand blue, for links, active tab rules and any small blue mark on white.
- Show a progress value as text beside its brand-blue bar, on a `--surface-3` track.

### Don't

- Write a hex value, a raw palette utility (`red-50`, `slate-400`) or a `rounded-2xl` in an OS file.
- Set white type on brand blue, or orange type on white.
- Set a figure in Georgia, or a date, amount or label in mono.
- Add a second accent. Violet, indigo, lime and terracotta exist only in the workstream map.
- Use orange anywhere except the dashboard attention count.
- Bring back a dark mode. The retired dark theme is deleted.

