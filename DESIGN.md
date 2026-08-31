---
name: Trailhead Holdings — Marketing Surface
description: A ruled bay plan on plan stock, where every service is a registered facing and colour is keyed data.
scope: app/(marketing) only. The authenticated Trailhead OS app under app/(os) and app/(app) uses a separate, unrelated dark system and inherits none of these tokens.
colors:
  plan-stock: "#e7eae4"
  plan-recess: "#dcdfd8"
  ticket-stock: "#fcfcfa"
  ink: "#14161a"
  ink-2: "#4a4f55"
  ink-3: "#595e64"
  hair: "rgba(20, 22, 26, 0.22)"
  flash: "#da2818"
  flash-deep: "#ab1c10"
  key-commercial: "#12379e"
  key-studio: "#f2b01e"
  key-studio-deep: "#7a5606"
  key-labs: "#0c6b45"
  key-build: "#8a5104"
  key-ink: "#ffffff"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6.6vw, 5.5rem)"
    fontWeight: 750
    lineHeight: 0.94
    letterSpacing: "-0.022em"
    fontVariation: "'wdth' 80"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 720
    lineHeight: 1.0
    letterSpacing: "-0.018em"
    fontVariation: "'wdth' 82"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.7vw, 1.6rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 88"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.62
    fontVariation: "'wdth' 100"
  body-sm:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.62
    fontVariation: "'wdth' 100"
  body-xs:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.62
    fontVariation: "'wdth' 100"
  figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 78"
  action:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
    fontVariation: "'wdth' 76"
  state:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.13em"
    fontVariation: "'wdth' 72"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.13em"
    fontVariation: "'wdth' 72"
  note:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "0.11em"
    fontVariation: "'wdth' 72"
  data:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  none: "0"
  mark-bar: "2px"
spacing:
  tick: "0.5rem"
  xs: "0.25rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  band: "3rem"
  band-lg: "4rem"
  gutter: "8.5rem"
  bay-max: "78rem"
components:
  flash:
    backgroundColor: "{colors.flash}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "0.85rem 1.35rem"
    typography: "{typography.label}"
  flash-hover:
    backgroundColor: "{colors.flash-deep}"
    textColor: "#ffffff"
  flash-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.85rem 1.35rem"
    typography: "{typography.label}"
  flash-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plan-stock}"
  ticket:
    backgroundColor: "{colors.ticket-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.05rem 1rem"
  facing:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1.75rem 1.75rem 2rem"
  brand-block:
    backgroundColor: "{colors.key-commercial}"
    textColor: "{colors.key-ink}"
    rounded: "{rounded.none}"
    padding: "2rem"
  key-state:
    backgroundColor: "transparent"
    textColor: "{colors.key-labs}"
    rounded: "{rounded.none}"
    padding: "0.24rem 0.5rem"
  input:
    backgroundColor: "{colors.ticket-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.75rem 0.875rem"
    size: "0.9375rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
  nav-link-hover:
    textColor: "{colors.flash}"
---

# Design System: Trailhead Holdings — Marketing Surface

> **Scope.** This system describes the public marketing surface only: everything rendered under `app/(marketing)`, scoped in CSS by the `.bay-plan` class in `app/(marketing)/bay.css`. The authenticated internal app ("Trailhead OS") under `app/(os)` and `app/(app)` runs a completely separate dark visual system and was deliberately left untouched. **Do not apply these tokens, classes or rules to the OS app, and do not apply the OS app's to this one.** The `.bay-plan` scope is the boundary; it is load-bearing, not stylistic.

## Overview

**Creative North Star: "The Category Manager's Planogram"**

The site is a bay plan. Trailhead's job is getting a thing onto a shelf it is not on yet, so the marketing surface is drawn the way a category manager draws a bay elevation: plan stock ground, black hairline rails with tick marks at a fixed pitch, each service or product a registered *facing* divided from its neighbours by rule, and a white shelf-edge *ticket* mounted beneath carrying the checkable fact — a code, a price, a date. Nothing floats. Nothing is rounded. There is no white ground, no card, and no blue accent, which is the founder-consultancy default the world was built to refuse.

Density is high and the surface is quiet. Colour does almost nothing: the page is stock and rule, and a keyed colour appears only where it identifies something — which sub-brand's bay you are standing in, whether a claim is live or in build, which action is the primary one. The result reads as a printed working document rather than a marketing page, which is the point: the site's argument is that a checkable fact sits under every claim, and the material makes that visible before the copy is read.

**Key Characteristics:**
- Plan stock ground (`#e7eae4`) with a black 1px rail and tick-marked hairlines, never white with cards
- Zero radius on every surface; the only rounding in the build is 2px on the four bars of the brand mark
- One type family (Archivo) across its width axis, with Martian Mono admitted for data only
- Colour is keyed data: a block fill that identifies a track, or a state key that identifies a claim's epistemic status
- Signal red (`#da2818`) as the single action/attention colour, everywhere and nowhere else
- Content ships fully visible; motion is a clip-wipe over the top of it, never a fade-in from hidden

## Colors

The palette is a printed one: a green-grey plan stock, near-black ink, and a hairline, plus four identity colours that are used as fills and states rather than as tints.

### Primary
- **Price Flash Red** (`#da2818`): The single signal colour. It fills every primary action (`.flash`), and it is the site's attention colour wherever attention is being directed — the focus-visible outline, the text selection, the caret, the underline on prose links, the directional arrow accent inside a link, the error message rule, and the hover colour of every nav link. **Deep Flash** (`#ab1c10`) is its pressed/hover fill. It is never used as a track identity and never as a decorative field.

### Secondary — the track keys
Each sub-brand owns one colour, resolved from the pathname onto `[data-track]` and consumed as `--key` (a block fill) or `--key-deep` (the same identity as type or a small graphic on plan stock).
- **Ink Blue** (`#12379e`): Trailhead Commercial. Block fill and type colour are the same value; white type sits on the block.
- **Chrome Yellow** (`#f2b01e`): Trailhead Studio. **Block fill only.** At 11px on plan stock it measures 1.5:1, so it must never be set as type.
- **Chrome Yellow Deep** (`#7a5606`): Studio's `--key-deep` — the same identity at 5.3:1 for any Studio-keyed type or small graphic on stock. This pair is the reason `--key` and `--key-deep` exist as separate tokens.
- **Plan Green** (`#0c6b45`): Trailhead Labs, and doubling as the `Live` state key. Block fill and type colour are the same value.

### Tertiary — the state keys
- **Build Amber** (`#8a5104`): the `In build` epistemic key. Measured at 5.1:1 on plan stock; it is a darkened relative of Studio's chrome yellow chosen for legibility, not a fourth brand colour.

### Neutral
- **Plan Stock** (`#e7eae4`): the printed ground. Every page sits on it.
- **Bay Recess** (`#dcdfd8`): the backboard behind a facing. Used to set an alternate band apart without introducing a second brightness world; also the footer ground and the inline-code ground.
- **Ticket Stock** (`#fcfcfa`): shelf-edge ticket and form-field ground. The only near-white in the system, and it only ever appears inside a 1px ink border.
- **Ink** (`#14161a`): rail, rule, primary type, scrollbar thumb, and the `pre` block ground.
- **Ink 2** (`#4a4f55`): body and secondary type (6.5:1 on stock).
- **Ink 3** (`#595e64`): annotation labels, gutter codes, captions (5.2:1 on plan stock, 4.8:1 on recess). **This is the floor.** It was raised during review and must not regress.
- **Hairline** (`rgba(20,22,26,0.22)`): every internal division — facing borders, ticket rules, tick marks, field borders at rest.

### Named Rules

**The Keyed-Colour Rule.** Colour identifies; it never decorates. A colour appears on this surface only to answer one of three questions: which bay am I in (`--key` / `--key-deep`), how sure is this claim (`.key-state`), or where do I act (`--flash`). There is no third option. A tint, a gradient, a coloured background applied for warmth or interest, or a coloured heading for emphasis are all outside the system.

**The Two-Block Rule.** A brand block (`.brand-block`) is a solid facing of one keyed colour. At most two are in view at once; everything else on the page is stock and rule. The colour commitment is total where it lands and absent everywhere else.

**The Deep-Relative Rule.** A key colour used as type or as a small graphic on plan stock must use its `--key-deep` value, never `--key`. Chrome yellow is the case that proves it: legible as a full block behind ink, illegible as 11px type. Any new track colour ships with both values or it does not ship.

**The No-Dimmed-Copy Rule.** Body copy is never dimmed with opacity to signal secondary or historical status. Where a distinction is needed, it is drawn — `.bar-tenure.is-archive` renders the same bar hollow (a 1px inset ring instead of a fill), which reads as "delisted" on a plan and costs nothing in contrast.

**The Coloured-Ground Rule.** On a brand block, secondary type is mixed from the block's own foreground (`color-mix(in srgb, var(--key-ink) 82%, var(--key))`), never from the grey ink ramp. Grey on a coloured ground is a different, worse colour on every track.

## Typography

**Display / Body / Label Font:** Archivo (variable, `wdth` axis loaded via `next/font`), with `ui-sans-serif, system-ui, sans-serif`
**Data Font:** Martian Mono (variable, via `next/font`), with `ui-monospace, SFMono-Regular, monospace`

**Character:** One condensed heavy grotesque doing the whole signage job. Hierarchy is carried by *width, case, rule weight and position* — never by a new face and never by a new colour. Display sets at 80% width, weight 750, tight; body relaxes to 100% width at normal weight; shelf-edge labels compress to 72% and set as tracked caps, the way a real shelf label is printed. The mono is the plan's numeric register, and it is set apart on purpose.

### Hierarchy
- **Display** (`wdth` 80, 750, `clamp(2.6rem, 6.6vw, 5.5rem)`, 0.94, `-0.022em`, balanced): one per page, the page's statement. Capped at 5.5rem; display never runs past 6rem.
- **Headline** (`wdth` 82, 720, `clamp(2rem, 4vw, 3.25rem)`, 1.0, `-0.018em`, balanced): the head of a band, sat against its rail.
- **Title** (`wdth` 88, 700, `clamp(1.25rem, 1.7vw, 1.6rem)`, 1.08, `-0.012em`): a facing's name, a ticket's heading, a blog row's title.
- **Lede** (`wdth` 100, 400, `clamp(1.125rem, 1.5vw, 1.375rem)`, 1.5, max 62ch, `text-wrap: pretty`): the paragraph directly under a display.
- **Body** (`wdth` 100, 400, `1.0625rem`, 1.62, Ink 2, max 68ch): all running prose. Long-form prose (`.marketing-prose`) runs the same size at 1.66 and the same 68ch measure.
- **Body small** (`.plan-body-sm`, `0.9375rem`): the same voice inside a facing, a project dossier, a form field or a ticket — anywhere the column is narrower than a reading measure.
- **Body extra-small** (`.plan-body-xs`, `0.875rem`): the tightest note. Detail values in a definition row, a legal footnote, an inline error.
- **Figure** (`.plan-figure`, `wdth` 78, 700, `1.75rem`, 1.0, `-0.015em`): a measured number set beside the evidence it summarises. Never the page's opening move — see the No-Hero-Metric rule.
- **Action** (`.flash` / `.flash-ghost`, `wdth` 76, 700, `0.8125rem`, `0.1em`, uppercase): the price flash and its outlined twin. The only step that exists to be clicked.
- **State** (`.key-state`, `wdth` 72, 650, `0.625rem`, `0.13em`, uppercase): the epistemic key. Deliberately the smallest step on the surface — it qualifies a claim, it never announces one.
- **Label** (`wdth` 72, 650, `0.6875rem`, `0.13em`, uppercase, 1.0): shelf-edge labels, nav items, ticket headings, inline back-links. Single line.
- **Note** (`wdth` 72, 650, `0.6875rem`, `0.11em`, uppercase, 1.45): the same voice when it has to wrap to two or three lines.
- **Data** (Martian Mono, 400, `0.6875rem`, `0.02em`, tabular): codes, prices, dates, counts, dimensions, tags, table cells.

### Named Rules

**The One Face Rule.** Archivo carries display, headings, body, and the caps labels. A second sans, a serif, or a system display face is out of the system — including for a "special" hero. If a level needs distinguishing, move along the width axis or change case, weight, rule or position.

**The Eight-Step Rule.** Every size on the surface is one of the steps above, and each is declared once as a token in `bay.css` (`--text-body`, `--text-body-sm`, `--text-body-xs`, `--text-action`, `--text-label`, `--text-state`, `--text-figure`, plus the three clamped heading steps). A literal `font-size` in CSS or a `text-[…]` arbitrary value in a class is drift, not a decision — this system reached 33 scattered one-off sizes before they were collapsed back onto the ramp, which is exactly how a type system dies. Add a step deliberately and document it here, or use one that exists.

**The Mono-Is-Data Rule.** `.plan-data` is admitted for codes, prices, dates, counts, dimensions, tags and table figures only. Mono running prose is a documented violation of this world, not a stylistic option. *(As built, the outer edge of this rule is the footer's registration line — a legally fixed string of registration facts, set in data. Nothing longer than that has earned mono, and nothing sentence-shaped should.)*

**The No-Kicker Rule.** A `.plan-label` never stands alone above a heading as an announcement. It is mounted — on a rail, on a ticket, or in the gutter — and it carries data (a bay code, a facing count, a track name in the chrome), not a section title in miniature. The layout enforces this: see The Gutter-Never-Above Rule in Layout.

**The Tabular Rule.** The whole surface sets `font-variant-numeric: tabular-nums`. Figures in a column line up; a price never shifts on hover.

## Layout

**The bay grid.** Every band is a `.bay`: `max-width: 78rem`, centred, `padding-inline: 1.25rem`. At `min-width: 60rem` it becomes a two-column grid — a fixed `8.5rem` gutter carrying the bay code, then the facings — with a `2.5rem` column gap and `2rem` inline padding. A child marked `.bay-full` spans both columns.

**The rail.** Every band on every page hangs from a `.rail`: a 1px ink top border with a `0.5rem` band of tick marks beneath it, repeating at a `2rem` pitch. `.rail-hair` is the lighter variant for internal divisions. The header rail carries the bay code, a drawn dimension callout (extension ticks and arrowheads, an SVG, not a text strip) and the domain; the footer is the bottom rail and carries the plan's title block.

**Band rhythm.** Bands are `py-12 md:py-16` (3rem / 4rem). The hero band runs tighter (`pt-7 pb-12`). Internal rhythm is a small set of steps used repeatedly: `0.25rem` between a label and its data, `1rem` after a heading, `1.5–2rem` before a grid of facings, `3rem` between subsections.

**Responsive.** The single breakpoint that changes the *model* is `60rem` (the gutter breakpoint); `48rem` and `64rem` only change facing padding and column counts. Facing grids go 1 → 2 → 3 columns. The header nav collapses to a bordered square menu trigger below `md`, opening a full-width ruled panel with the primary action and Log in at its foot — the footer index is the always-visible second route to every page on a phone.

### Named Rules

**The Gutter-Never-Above Rule.** The bay code (`.bay-code`) never sits above a heading. At desktop it is a margin column, beside the statement. Below `60rem` the bay collapses to one column and the gutter takes `order: 2`, dropping to the foot of its band with a hairline above it — where a drawing keeps its annotation block. Stacking it above the heading would make it a kicker, and nothing on this site earns one. **The carve-out:** `.bay-code-lead` takes `order: 0` and leads the band, and it is reserved for a gutter carrying *navigation* — a back link is a control, not a label, so it belongs where the reader looks first.

**The Measure Rule.** Body holds at 68ch, lede at 62ch, and a display headline is clamped by `ch` at its call site (`max-w-[19ch]`, `max-w-[16ch]`). A full-bleed line of running text is not in this system.

## Elevation & Depth

**There are no shadows.** Not one `box-shadow` in this surface is used as elevation; the single `box-shadow` in the stylesheet is `inset 0 0 0 1px` drawing a hollow bar, which is a stroke, not a lift. Depth is entirely tonal and linear: three ground values (bay recess behind, plan stock as the page, ticket stock as the mounted object), separated by rules of two weights (1px ink for a real edge, the hairline for an internal division). A ticket reads as *in front* because it is lighter and bordered in full ink, not because it casts anything.

### Named Rules

**The Nothing-Floats Rule.** No drop shadow, no glow, no lifted card, no offset "hard" shadow, no blur, no backdrop-filter. If a thing needs to read as separate, give it a ground change and a rule.

**The Motion-Reveals-Nothing Rule.** Content is never shipped hidden. `.marketing-reveal` is explicitly `opacity: 1; transform: none` inside `.bay-plan` — the specificity deliberately beats the legacy hidden-by-default reveal in `globals.css` whatever order the sheets land in — and the entrance is a `clip-path` wipe (`rack-in`, 720ms, `cubic-bezier(0.16, 1, 0.3, 1)`) that runs *over* fully-present content, left to right, the direction the whole site travels. A blocked chunk, a crawler, or a user with `prefers-reduced-motion: reduce` sees the complete page; reduced motion also removes the 3px hover nudge on both button variants.

## Shapes

**Zero radius, everywhere.** `.facing`, `.ticket`, `.flash`, `.flash-ghost`, `.key-state`, every form field, `code`, and `pre` are all square. The stylesheet explicitly resets `border-radius: 0` on prose `code` and `pre` to defeat inherited defaults. The one exception in the entire build is the brand mark: four ascending bars with `rx="2"`, a fixed brand commitment that predates and outranks the world.

**Two rule weights.** 1px solid ink is a real edge — a ticket border, a form's outer frame, a rail, a table's head rule. The hairline is an internal division — between facings, inside a ticket, under a table row, around a field at rest. Mixing them is how the drawing keeps its hierarchy without a third value.

**The drawn mark language.** Every icon in the set (`PlanIcon`) is one 1.5px stroke on a 16px box with **butt caps and mitre joins**, drawn to match inked plan linework rather than a typeface's terminals. Arrows have a shaft and a two-line head; they are drawn arrows, not chevrons, and never Unicode glyphs (`→`, `↗`, `+`) borrowed from the running face.

## Components

### Buttons — the price flash
The primary action is a price flash: the loudest thing a shelf carries, and it means one thing.
- **Shape:** square (0 radius), no border.
- **Primary (`.flash`):** signal red ground, white caps at `wdth` 76 / 700 / `0.8125rem` / `0.1em`, padding `0.85rem 1.35rem`, usually with a drawn right-arrow at the end.
- **Hover:** deepens to `#ab1c10` and translates 3px along the rail direction, 180ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Ghost (`.flash-ghost`):** transparent with a 1px ink border and ink caps; on hover it inverts to an ink ground with plan-stock type, same 3px nudge. Used for the secondary action only (Log in on mobile).
- **Disabled:** `opacity: 0.6` with `not-allowed` — the one sanctioned opacity dim, and it applies to a control, never to copy.
- **Placement rule:** the flash never prints on a brand block. It prints on the white ticket at the block's foot, which is where it belongs physically and the only place red stays legible against chrome yellow.

### The shelf-edge ticket (signature component)
The only bordered container in the system, and the only one carrying near-white stock.
- **Corner style:** square.
- **Background / border:** ticket stock inside 1px ink.
- **Distinctive behavior:** a **mounting notch** — a 2.25rem × 3px ink bar drawn across the top edge, inset 1.05rem from the left, where the ticket clips into the rail. It is what makes the ticket read as mounted rather than as a card.
- **Internal padding:** `0.9rem 1.05rem 1rem`; `.ticket-rule` divides its head from its body with a hairline.
- **Contents:** codes, prices, dates, registration facts, and primary actions. On a brand block a ticket resets its type to ink.

### Facings (containers — *not* cards)
- **Corner style:** square. **Shadow:** none. **Background:** transparent by default; occasionally plan stock over a recess band.
- **Border:** the grid draws it — `.facings` carries the top and left hairlines, each `.facing` carries right and bottom, so an N-column grid reads as one ruled table rather than N floating objects.
- **Padding:** `1.5rem 1.5rem 1.75rem`, opening to `1.75rem 1.75rem 2rem` at `48rem`.
- **Hover (when linked):** ground change to ticket stock only. No lift, no border colour change, no scale.

### Brand blocks
A full facing of one keyed colour standing hard against its neighbour, as two brands sit adjacent in a bay. Sets `--key` / `--key-ink`; secondary copy is mixed from the block's own foreground; list rules are mixed from it too (26% over transparent). Named `.brand-block` and not `.block` because Tailwind ships `.block` as a display utility and the short name silently repainted every element using it for layout.

### Epistemic keys (signature component)
`.key-state` is a bordered caps chip (1px `currentColor`, 0.24rem × 0.5rem, `wdth` 72 / 650 / `0.625rem` / `0.13em`) with a 5px square bullet drawn in the same colour. **What each one asserts is load-bearing; misusing them makes the site dishonest.**
- **`.key-live`** (plan green): this exists, it is running, and it has paying customers. A claim keyed Live must be verifiable today.
- **`.key-build`** (build amber): this is real work in progress, not yet shipped or not yet priced. It asserts intent, not availability.
- **`.key-illustrative`** (Ink 3, with a 45° hatched bullet): **this is a drawing, not a capture.** It marks authored structure standing where a real artifact belongs. The hatch is the tell — the same convention a plan uses for indicative fill.
- **`.bar-tenure.is-archive`**: a hollow bar (1px inset ring, no fill) where a solid one means current. It marks a facing that is no longer on shelf.
- **Pairing rule:** a real capture must never carry a key that says it is a drawing, and a drawing must never lose it. When a real asset replaces an illustrative one, the `Illustrative` key is deleted in the same commit.

### Inputs / fields
- **Style:** ticket stock inside a 1px hairline, square, `0.9375rem` type, `0.875rem × 0.75rem` padding. Labels are `.plan-label` in Ink 2 above the field.
- **Hover:** border to Ink 2. **Focus:** border to signal red with `outline: none` — the field's own border *is* the focus indicator, and the caret is red to match. Every other focusable element on the surface takes the global `2px` signal-red `:focus-visible` outline at `2px` offset.
- **Error:** a bordered message block in signal red on ticket stock, `role="alert"`, above the submit.
- **Select:** appearance reset with a drawn 11×7 ink chevron inset `0.9rem` from the right; textarea resizes vertically only.
- **Form frame:** the whole form is a 1px ink box on plan stock — a ticket's frame around a ticket's fields.

### Navigation
Caps labels (`.plan-label`) in Ink 2, hovering to signal red; the cross-track link sits one step quieter in Ink 3. Log in is a hairline-bordered box that darkens to full ink on hover — visually subordinate to the flash CTA beside it. The header is sticky on plan stock with the rail beneath it, so the bay code and dimension callout stay in view. Below `md`, an 11×11 ink-bordered square trigger opens a ruled full-width panel; the panel locks scroll, closes on Escape, returns focus to the trigger, and closes on route change.

### The plate slot
`PlateSlot` is the mount for a real photograph or screenshot: a 1px ink border on ticket stock, no radius, with a `.plan-data` caption in Ink 3 beneath. **Without a `src` it renders nothing at all** — no grey box, no gradient, no device mockup. The site ships imagery-free rather than faking an asset it does not have.

## Do's and Don'ts

### Do:
- **Do** hang every band from a rail and register its content as facings divided by rule.
- **Do** put the checkable fact — code, price, date, count — on a ticket, in Martian Mono, near the claim it supports.
- **Do** use `--key-deep` for any key-coloured type or small graphic on plan stock; `--key` is a block fill.
- **Do** keep annotation type at Ink 3 (`#595e64`) or darker. It is a measured floor (5.2:1 on stock, 4.8:1 on recess) that was raised during review.
- **Do** key any claim whose status is not self-evident with `.key-state`, and delete the `Illustrative` key in the same change that replaces the drawing with a real capture.
- **Do** draw icons as 1.5px single-stroke SVG with butt caps and mitre joins, sized to the label beside them.
- **Do** ship content visible and let motion wipe over it, with a `prefers-reduced-motion` cut-out.
- **Do** put a gutter code in the margin at desktop and at the foot of its band on mobile; `.bay-code-lead` only when the gutter carries a back link.

### Don't:
- **Don't** build a card. No radius, no shadow, no floating panel, no hover lift. `.ticket` is the only bordered container and it earns its border by being a mounted object.
- **Don't** put a `.plan-label` alone above a heading as a kicker or eyebrow. Mount it, or set it in the gutter, or delete it.
- **Don't** set Martian Mono in running prose. It is admitted for codes, prices, dates, counts and dimensions only.
- **Don't** introduce a second type family, a serif, or a system display face for emphasis; move along Archivo's width axis instead.
- **Don't** set chrome yellow (`#f2b01e`) as type on plan stock at any size — 1.5:1 at 11px. Use `#7a5606`.
- **Don't** dim body copy with opacity to indicate secondary, historical or inactive status. Draw the distinction (hollow bar, hairline, ground change) instead.
- **Don't** use signal red as a field, a ground for content, or a track identity. It marks action, focus, selection and error, and its rarity is what makes it work.
- **Don't** render a placeholder image, grey box, gradient, stock photo or device mockup where a real asset is missing. Render nothing.
- **Don't** apply any of this to `app/(os)` or `app/(app)`. The OS app is a separate dark system and the `.bay-plan` scope is the boundary.

## Open, not resolved

Recorded so nobody reads a gap as a decision:
- The surface ships with **no photography, no product screenshots and no client logos** (`.impeccable/ASSETS.md`). Slots exist and are shaped; they are empty.
- The Studio hero's job docket is an **authored drawing keyed `Illustrative`**, standing where a real Engineer OS screenshot belongs. The key is honest; the drawing is still a stand-in.
- Entrance motion is currently **one identical `rack-in` per section**, not a single authored moment. The grammar is right; the authoring is not done.
