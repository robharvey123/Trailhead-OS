# Brief 6: outreach engine fixes before first send

Audit of commits `9b7a407`, `016aa28`, `dc1ed1d`, `1ede113`, `6851157`, `7a7db72`, run 26 July 2026. All six commits confirmed on `main`, in sync with `origin/main`, both migrations present, `netlify.toml` gone, all new files where the briefs said they would be.

## What is genuinely right

Worth saying before the defect list, because these were the parts most likely to go wrong and they did not:

- **DST handling is correct.** `startOfZonedDayUtc` was exercised against both 2026 London transitions (29 March forward, 25 October back) and returns true local midnight in every case. The guess-and-correct is safe because London's transition is at 01:00 UTC and the correction window is only 23:00Z to 00:00Z. Window and weekday checks use `Intl` parts in the campaign timezone rather than UTC arithmetic, and `timeToMinutes` handles Postgres's `'07:30:00'` format.
- **RLS is consistent with the lockdown migration.** All nine new tables get `is_employee()` for-all policies, nothing is left policy-less, and `outreach_campaign_stats` is correctly `security_invoker = true` so it inherits base-table RLS instead of becoming a definer-side read hole.
- **Webhook verification is right.** Raw body via `request.text()` taken before any parse, all three `svix-*` headers passed to `new Webhook(secret).verify`, and a missing secret 500s rather than accepting unsigned payloads. The monotonic `RANK` advance correctly stops an out-of-order `opened` clobbering a `clicked`.
- **Escaping direction is right.** Subject rendered with `escape: false` (escaping it would emit literal `&amp;` in the header), body defaults to escaped.
- **Unsubscribe does not leak.** Unknown and known tokens are indistinguishable by status or body, and the tokens are 122-bit UUIDs.

Your three flagged deviations are all fine calls. The `sub_trade` / `size_signal` columns were a real gap in my brief. The typecheck heap bump is correct, TipTap's types do OOM tsc at 2GB.

---

## Must fix before the first send

### 1. The CTPS exclusion currently excludes nobody

`supabase/migrations/20260725100000_outreach_engine.sql:14` declares `ctps_registered boolean` nullable with no default. Nothing in the repo ever writes it: `grep -rn ctps_registered app lib scripts components` returns only the type declaration in `lib/types.ts:126` and the two query lines.

`lib/db/outreach.ts:147` filters with `.not('contact.ctps_registered', 'is', true)`, which compiles to `NOT (ctps_registered IS TRUE)`. For NULL that is `NOT FALSE`, which is **true**. Every unscreened contact passes.

So all 100 imported contacts will appear in a queue whose page copy tells the operator "CTPS-registered and do-not-call numbers are excluded". That is worse than having no filter, because it manufactures false confidence in front of a PECR regulation 21 breach.

**Fix.** Gate on screening having happened, not just on the flag: require `ctps_checked_at is not null` **and** `ctps_registered is not true`. An unscreened contact should be invisible in the call queue, not callable. Add a banner showing how many contacts are unscreened so the gap is loud rather than silent. Also add `ctps_registered` and `ctps_checked_at` to `ImportRow` in `app/api/contacts/import/route.ts` so screening results can be loaded by CSV rather than by hand.

### 2. Unsubscribe mutates on GET, so link scanners will unsubscribe your prospects

`app/api/outreach/unsubscribe/[token]/route.ts:26` calls `applyUnsubscribe` from the `GET` handler, and that URL is the visible footer link in `lib/outreach/send.ts:70`.

Mimecast, Barracuda and Outlook Safe Links issue GETs against every URL in an inbound message before the recipient sees it. Corporate mail filtering is near-universal among firms of this size, which is exactly who is on this list. The result is prospects marked `do_not_email = true` and suppressed without a human ever clicking, and because the suppression is global they are burned for future campaigns too.

**Fix.** The footer link points at a confirmation page that POSTs. Keep `GET` as render-only. The RFC 8058 one-click path at line 33 is already correctly POST-only and should stay as is, because that one is a genuine user action from the mail client.

### 3. No try/catch in the scheduler, and `renderTemplate` throws by design

`lib/outreach/scheduler.ts` has no `try`/`catch` anywhere (confirmed by grep). `lib/outreach/render.ts:29` throws on an unresolved token, which is the correct design decision, but nothing catches it.

The claim at line 133 has already set `next_send_at = null`, and the due query at line 99 is `.lte('next_send_at', now)`, which excludes NULL. So a throw leaves the recipient in `status = 'active'` with no next send, permanently unreachable, and the whole tick aborts so every later campaign is skipped too.

The trigger is not exotic: you are about to hand-write four templates, and one `{{first_name}}` where the var map has `{{email_greeting}}` bricks four recipients an hour, silently, with the only symptom a 500 on a cron nobody watches.

**Fix.** Wrap the per-recipient body in try/catch. On a render error, mark the recipient `stopped` with a new `stopped_reason = 'error'` and record the message, so it surfaces in the UI instead of vanishing. Never leave a claimed recipient with a NULL `next_send_at` and no terminal status. Separately, validate every template against `OUTREACH_TEMPLATE_VARS` when a campaign moves to `running`, so a bad token is caught at the button rather than at send time.

### 4. The suppression check fails open

`lib/outreach/send.ts:39` and `lib/outreach/scheduler.ts:111` both use:

```ts
const { data: suppressed } = await db.from('email_suppressions').select('id').ilike('email', email).maybeSingle()
```

Two problems that compound, and the error is discarded in both places:

`_` is an ILIKE wildcard and is legal in an email local part, so `sales_uk@firm.co.uk` matches `sales.uk@…`, `sales-uk@…` and so on. And `.maybeSingle()` returns `data = null` plus a discarded PGRST116 error when more than one row matches. A multi-row match is therefore indistinguishable from "not suppressed", **and the email sends**.

Concrete trigger: the suppression list holds both `sales.uk@firm.co.uk` and `sales_uk@firm.co.uk` (the unique index is on `lower(email)`, so both coexist). Sending to the underscore address matches both, returns null, and mail goes to an address that unsubscribed.

**Fix.** `.eq('email', email.toLowerCase())` with `.limit(1)`, which also uses the `lower(email)` unique index instead of forcing a scan. Check the error and treat any error as suppressed. This is the one place where failing closed is obviously right.

### 5. The compliance footer has no street, postcode or company number

`lib/outreach/send.ts:64` builds the address from `company_name, address_line1, city, postcode, country`, but `os_company_settings` is seeded with only name, city, country, email and company number. `address_line1` and `postcode` are nullable and never populated, so `.filter(Boolean)` yields:

> Trailhead Holdings Ltd, Brentwood, Essex, United Kingdom

No street, no postcode, no registered number, in commercial email to UK businesses, under a code comment that calls it "legally required".

**Fix.** Reuse `renderCompanyEmailFooterHtml` from `lib/company-settings.ts:95`, which already emits `address_line2` and "Registered in England & Wales 16910286". Do not maintain a second weaker implementation. Then populate `address_line1` and `postcode` in `os_company_settings`.

### 6. Placeholder copy is shippable and invisible

`scripts/seed-engineer-os-campaign.ts:64` writes a body containing the literal string `[Replace this placeholder copy before starting the campaign.]` into all four templates. Nothing in the app renders a template body: the templates page lists name and subject only, the campaign detail lists step template names only, and there is no template editor in the diff. `app/(os)/outreach/[id]/actions.ts:23` sets status to `running` with no validation.

So the shortest path from here to production is: seed, click Start, and 100 businesses receive placeholder text.

Same string also has `{{company}}{{size_signal}}` concatenated with no separator, rendering as "teams like Acme Ltd12 engineers."

**Fix.** A template body editor or at minimum a read-only preview with a rendered sample contact. Block the transition to `running` if any step's template body still contains `[Replace` or fails var validation.

---

## Fix before you scale past the first batch

### 7. The optimistic claim does not protect steps 2 and 3

`lib/outreach/scheduler.ts:133` guards with `.eq('status', r.status)`. Recipients are selected `.in('status', ['pending','active'])` and every successful send sets `status: 'active'`, so from step 2 onward the guard is `WHERE id = $1 AND status = 'active'` updating status to `'active'`. Under READ COMMITTED, a second transaction blocks on the row lock, re-evaluates the predicate against the new tuple, still sees `'active'`, updates, and gets a row back. Both ticks win. Only the initial `pending → active` transition is genuinely exclusive.

The cron route's own docstring at line 9 claims the opposite guarantee.

Overlapping ticks are unlikely at `*/15` with `maxDuration = 60`, so this is not a first-send blocker, but there is no database backstop: `outreach_sends` has no unique index on `(recipient_id, step_id)`.

**Fix.** Add `create unique index on outreach_sends (recipient_id, step_id)` and let the insert be the source of truth. Then make the claim carry a token: add `claimed_at` and guard on `next_send_at is not null`, or compare-and-swap on `current_step`. The unique index alone removes the user-visible harm and is a one-line migration.

Related, same root: `lib/outreach/send.ts:89` treats a Resend error as transient and `scheduler.ts:149` retries the **same** step an hour later without advancing `current_step`. If Resend accepted the message and the HTTP response was lost, that is a real duplicate delivery. The unique index fixes this too, provided the `outreach_sends` row is written before or atomically with the send.

### 8. Daily cap is read-then-act, and is per-campaign not per-domain

`budget` is computed once per campaign at line 78 and used only as `.limit(budget)`. Nothing re-reads it inside the loop, so two overlapping ticks each send up to the full cap. And because the count filters on `campaign_id`, four sector campaigns sharing one `from_email` would put four times the cap through a warming domain.

That last point is the deciding argument in the template question below.

### 9. Bounces and complaints on non-outreach mail are dropped

`app/api/webhooks/resend/route.ts:43` returns early when no `outreach_sends` row matches, before the switch, so `stopRecipient` never runs. The webhook is shared with invoice and notification mail, so a hard bounce or spam complaint on those streams never reaches `email_suppressions` and that address stays eligible for a future cold campaign. Same hole applies to a bounce that races the `outreach_sends` insert, which happens after `emails.send()` resolves.

**Fix.** Write bounces and complaints to `email_suppressions` keyed on the event's recipient address regardless of whether a send row is found.

### 10. Import duplicate guard silently disables itself past 1000 contacts

`app/api/contacts/import/route.ts:97` selects all contact emails unpaginated. PostgREST caps at the project `max-rows`, 1000 by default, so past 1000 contacts with an email the guard sees a partial snapshot. The error is discarded too, so a failed query yields an empty set and no guard at all. There is no unique constraint on `contacts.email` to back it up, and `outreach_recipients` is unique on `(campaign_id, contact_id)`, not on email, so two contact rows for one person means that person gets every step twice.

Fine for this import at 100 rows. Fix before the list grows.

---

## Smaller, worth noting

**Empty merge values are not caught.** `render.ts:28` throws only when a key is absent from the map, but `send.ts:49` builds the map with `contact.company ?? ''`, so all seven keys always exist. A contact with no company gets the subject "A quick idea for ". Throw on empty as well as missing, or require the vars at audience-build time.

**Seed delays are cumulative, not absolute.** `scheduler.ts:162` computes `next_send_at` as now plus `delay_days`, so the seed's `[0, 3, 8]` produces sends on day 0, 3 and **11**. Either rename the column to `delay_days_after_previous` or convert to absolute offsets. Also, `delay_days: 0` on a non-first step would fire on the very next tick, 15 minutes later.

**`getCompanySettings` never rejects,** so `.catch(() => null)` at `send.ts:62` is dead code and the fallback branch is unreachable.

---

## The sector template question

You are right that four sector templates and three linear steps do not fit a one-template-per-step engine. Two workable answers:

**Four campaigns, one per sector.** No code change. But defect 8 makes this actively bad right now: the cap is per campaign, so four campaigns at cap 15 put 60 a day through a domain you are warming. You would have to set each to 4 and remember why. It also splits your stats four ways and quadruples the admin for a difference that only matters on step 1.

**Per-step template overrides keyed on channel.** Recommended, and small. Add:

```sql
create table if not exists outreach_step_template_overrides (
  step_id uuid not null references outreach_campaign_steps(id) on delete cascade,
  channel text not null,
  template_id uuid not null references outreach_templates(id),
  primary key (step_id, channel)
);
```

Resolution in `send.ts`: look for an override matching `contact.channel`, fall back to `step.template_id`. That is roughly forty lines including the migration. One campaign, one cap, one set of stats, sector-tailored first touch, generic follow-ups. `contacts.channel` is already populated with the sector by the import CSV, so nothing else has to change.

Take the second. Then fix the seed, which currently wires the electrical and HVAC **first-touch** templates to steps 2 and 3, so a fire and security firm would receive two other sectors' cold opens as its follow-ups.

---

## Suggested order

1. Defects 1 to 6, all first-send blockers
2. The unique index from defect 7, one line, removes the duplicate-delivery risk cheaply
3. Template overrides and the seed rewiring
4. Defects 8 to 10 before the second campaign
