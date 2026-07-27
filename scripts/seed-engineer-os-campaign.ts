/**
 * Seed the Engineer OS outreach campaign.
 *
 * Usage:
 *   npx tsx scripts/seed-engineer-os-campaign.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Idempotent: re-running find-or-creates by name and skips existing members /
 * recipients / steps. Leaves the campaign in `draft`.
 *
 * Prerequisite: import the 100-firm CSV first (contacts tagged
 * "Engineer OS outreach 2026-07" with a non-empty email).
 *
 * TEMPLATES: one linear campaign. Step 1 uses a default first-touch template with
 * per-channel overrides (one per named sector in SECTOR_COPY) so each sector gets
 * its own cold open; steps 2 and 3 are generic follow-ups. Real copy is embedded
 * below and installed in place (upsertTemplate updates existing rows by name), so a
 * re-run refreshes the wording. Only {{email_greeting}}, {{company}} and {{city}}
 * are ever used; the sector angle comes from which template is chosen, not tags.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const AUDIENCE_TAG = 'Engineer OS outreach 2026-07'
const AUDIENCE_NAME = 'Engineer OS cold list 2026-07'
const PROJECT_NAME = 'Engineer OS outreach'
const CAMPAIGN_NAME = 'Engineer OS cold outreach'

function loadEnv(filePath: string) {
  try {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

loadEnv(resolve(process.cwd(), '.env.local'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, serviceKey)

const DEFAULT_FIRST_TOUCH = 'Engineer OS — first touch (default)'
const FOLLOWUP_1 = 'Engineer OS — follow-up 1'
const FOLLOWUP_2 = 'Engineer OS — follow-up 2'

// --- Email copy -------------------------------------------------------------
// Written for a reply, not a click. Bright Fire Services of Harlow is named at
// Rob's direction (confirm they are happy to be named before the first send).
// Only {{email_greeting}}, {{company}} and {{city}} are safe to merge — every row
// has clean values for all three. {{name}}, {{sub_trade}} and {{size_signal}} are
// deliberately never dropped into a sentence: name falls back to the company for
// firms with no published director, and the other two hold research notes / comma
// lists that read badly mid-sentence. No footer here — sendCampaignEmail appends
// the company footer and unsubscribe link automatically. The first touch and the
// sector overrides carry no links (the ask is a reply); only the two follow-ups
// do, as bare URLs so mail clients auto-link them while they still read as typed.

type Copy = { subject: string; body: string }

const FIRST_TOUCH: Copy = {
  subject: 'how {{company}} gets job sheets back from site',
  body: `<p>Hi {{email_greeting}},</p>

<p>I build software for field service teams, and operators your size keep telling me the same thing: the work is the easy part, it is getting the paperwork back off site that costs you.</p>

<p>I built Engineer OS for Bright Fire Services, a fire and security contractor in Harlow, whose job tracking was a WhatsApp group, a Word template and a filing cabinet. Engineers now fill the form on their phone at the job, photos and signatures attach themselves, and the paperwork lands in the office before they have left the car park.</p>

<p>Out of interest, how do your engineers get job sheets back to you at the moment?</p>

<p>Rob Harvey</p>`,
}

// Step-1 overrides, keyed on the exact contacts.channel values in the list.
const SECTOR_COPY: Record<string, Copy> = {
  'Fire & Security': {
    subject: 'certificates and expiry dates at {{company}}',
    body: `<p>Hi {{email_greeting}},</p>

<p>Question for a fire and security firm: when a client's insurer asks you to prove every alarm on a site was serviced on time, how long does that take to put together?</p>

<p>I ask because I built Engineer OS for Bright Fire Services in Harlow, who were doing exactly that from a Word template and a shared drive. Engineers complete the service form on their phone at the panel, photos and a drawn signature attach to it, and the certificate files itself against the site. Expiry dates arrive as a reminder rather than a surprise.</p>

<p>How are you handling that at {{company}} at the moment?</p>

<p>Rob Harvey</p>`,
  },
  'Electrical & M&E': {
    subject: 'EICRs coming back from site at {{company}}',
    body: `<p>Hi {{email_greeting}},</p>

<p>For a commercial electrical firm, how much of the week goes on turning what your engineers wrote on site into a client-ready EICR?</p>

<p>I built Engineer OS for Bright Fire Services, a fire and security contractor in Harlow, whose certificates were retyped in the office from paper. The same problem, different form. The engineer now completes the schedule on their phone, results tables included, and the report generates branded and ready to send. It works with no signal and syncs when the van is back in range.</p>

<p>Curious how {{company}} does it today. Still retyping, or have you got that solved?</p>

<p>Rob Harvey</p>`,
  },
  'HVAC & Refrigeration': {
    subject: 'F-Gas records across sites at {{company}}',
    body: `<p>Hi {{email_greeting}},</p>

<p>Question for someone running commercial refrigeration and air conditioning service: where does the F-Gas record for a given unit actually live? The engineer's notes, an office spreadsheet, or somewhere between the two?</p>

<p>I built Engineer OS for Bright Fire Services in Harlow, after watching them lose most of an afternoon reconstructing service history for one client audit. Every unit is now an asset with its own service history, the engineer logs the check on site against that asset, and the record is one click away when someone asks for it.</p>

<p>How does {{company}} handle it at the moment?</p>

<p>Rob Harvey</p>`,
  },
  'Plumbing, Heating & Gas': {
    subject: 'gas safety records at {{company}}',
    body: `<p>Hi {{email_greeting}},</p>

<p>For commercial gas and heating work the job is rarely the hard part. Proving it happened, on time, to whoever is asking, usually is.</p>

<p>I built Engineer OS for Bright Fire Services, a fire and security contractor in Harlow, whose certificates and no-access visits were tracked on a whiteboard. Engineers now complete the gas safety record on their phone at the property, it files itself against the site, and anything approaching expiry surfaces before it lapses rather than after.</p>

<p>How is {{company}} keeping on top of that now?</p>

<p>Rob Harvey</p>`,
  },
}

const FOLLOWUP_1_COPY: Copy = {
  subject: 'one more thought',
  body: `<p>Hi {{email_greeting}},</p>

<p>Following up on my note earlier in the week.</p>

<p>The thing that surprised me most building this: the firms that got the most out of it were not the ones with the worst systems. They were the ones already trying to do it properly with tools that fought them. A spreadsheet per client, a Word template per form, a WhatsApp group per job.</p>

<p>I am taking on ten founding customers at the moment. Three months free, no card, and I do the setup myself: your customers and jobs imported, your forms rebuilt. The detail is at engineeros.uk/founding.</p>

<p>If that is not {{company}}, say so and I will leave you alone. If it is, I would still rather hear what you have tried than send you to a web page.</p>

<p>Rob</p>`,
}

const FOLLOWUP_2_COPY: Copy = {
  subject: 'closing the loop',
  body: `<p>Hi {{email_greeting}},</p>

<p>I have written twice and not heard back, which usually means one of three things. It is not a problem worth solving right now, you have already solved it, or you are busy running a business.</p>

<p>All three are fine. I will not chase again.</p>

<p>If it is the third one, reply whenever suits and I will pick it up then. If you would rather just have a look in your own time, it is engineeros.uk.</p>

<p>Rob</p>`,
}

async function findOrCreate<T extends { id: string }>(
  table: string,
  matchColumn: string,
  matchValue: string,
  insert: Record<string, unknown>
): Promise<T> {
  const { data: existing } = await db.from(table).select('*').eq(matchColumn, matchValue).maybeSingle()
  if (existing) return existing as T
  const { data, error } = await db.from(table).insert(insert).select('*').single()
  if (error) throw new Error(`${table}: ${error.message}`)
  return data as T
}

/**
 * Install a template by name: update the copy in place if it already exists (so a
 * re-run refreshes wording and clears any old "[Replace" placeholder), else insert.
 */
async function upsertTemplate(name: string, copy: Copy): Promise<string> {
  const { data: existing } = await db.from('outreach_templates').select('id').eq('name', name).maybeSingle()
  if (existing) {
    const { error } = await db.from('outreach_templates').update({ subject: copy.subject, body_html: copy.body, body_text: null }).eq('id', existing.id)
    if (error) throw new Error(`outreach_templates update "${name}": ${error.message}`)
    return existing.id as string
  }
  const { data, error } = await db.from('outreach_templates').insert({ name, subject: copy.subject, body_html: copy.body, body_text: null }).select('id').single()
  if (error) throw new Error(`outreach_templates insert "${name}": ${error.message}`)
  return data!.id as string
}

async function main() {
  // Workstream for app-dev.
  const { data: ws } = await db.from('workstreams').select('id').eq('slug', 'app-dev').maybeSingle()
  if (!ws) throw new Error('No workstream with slug "app-dev"')

  // Project.
  const project = await findOrCreate<{ id: string }>('projects', 'name', PROJECT_NAME, {
    name: PROJECT_NAME, workstream_id: ws.id, status: 'active',
  })
  console.log(`Project: ${project.id}`)

  // Audience + members (tagged contacts with an email).
  const audience = await findOrCreate<{ id: string }>('outreach_audiences', 'name', AUDIENCE_NAME, {
    name: AUDIENCE_NAME, description: 'Cold outreach list imported July 2026',
  })
  const { data: contacts } = await db.from('contacts').select('id, email, channel, tags').contains('tags', [AUDIENCE_TAG])
  const withEmail = (contacts ?? []).filter((c) => c.email && String(c.email).trim())
  if (withEmail.length > 0) {
    await db.from('outreach_audience_members')
      .upsert(withEmail.map((c) => ({ audience_id: audience.id, contact_id: c.id })), { onConflict: 'audience_id,contact_id', ignoreDuplicates: true })
  }
  console.log(`Audience: ${audience.id} — ${withEmail.length} members with email`)

  // Templates: one default first-touch (step-1 fallback), one per named sector
  // (channel) for the step-1 override, and two generic follow-ups. Real copy is
  // installed in place, so a re-run over old placeholder rows refreshes the wording.
  const channels = [...new Set(withEmail.map((c) => String(c.channel ?? '').trim()).filter(Boolean))]
  const firstTouchId = await upsertTemplate(DEFAULT_FIRST_TOUCH, FIRST_TOUCH)
  const followup1Id = await upsertTemplate(FOLLOWUP_1, FOLLOWUP_1_COPY)
  const followup2Id = await upsertTemplate(FOLLOWUP_2, FOLLOWUP_2_COPY)

  // Only build a sector override for channels we actually have copy for. Any
  // channel without copy quietly falls back to the (real) default first-touch
  // rather than a placeholder, so it can never block the campaign from starting.
  const sectorTemplates = new Map<string, string>()
  for (const channel of channels) {
    const copy = SECTOR_COPY[channel]
    if (!copy) {
      console.warn(`  ! No sector copy for channel "${channel}" — it will use the default first-touch.`)
      continue
    }
    sectorTemplates.set(channel, await upsertTemplate(`Engineer OS — ${channel}`, copy))
  }
  console.log(`Templates: ${3 + sectorTemplates.size} (default + ${sectorTemplates.size} sectors + 2 follow-ups)`)

  // Campaign (draft).
  const campaign = await findOrCreate<{ id: string }>('outreach_campaigns', 'name', CAMPAIGN_NAME, {
    name: CAMPAIGN_NAME,
    project_id: project.id,
    audience_id: audience.id,
    status: 'draft',
    from_name: process.env.OUTREACH_FROM_NAME ?? 'Rob Harvey',
    from_email: process.env.OUTREACH_FROM_EMAIL ?? 'hello@mail.engineeros.uk',
    reply_to: process.env.OUTREACH_REPLY_TO ?? 'rob@trailheadholdings.uk',
    daily_send_cap: 15,
  })
  console.log(`Campaign: ${campaign.id} (draft)`)

  // Steps. delay_days = days AFTER the previous step, so [0, 3, 5] => days 0, 3, 8.
  // Step 1 uses the default first-touch; sector overrides swap it per channel.
  const stepSpec = [
    { step_number: 1, template_id: firstTouchId, delay_days: 0 },
    { step_number: 2, template_id: followup1Id, delay_days: 3 },
    { step_number: 3, template_id: followup2Id, delay_days: 5 },
  ]
  const stepIds: Record<number, string> = {}
  for (const s of stepSpec) {
    await db.from('outreach_campaign_steps').upsert(
      { campaign_id: campaign.id, step_number: s.step_number, template_id: s.template_id, delay_days: s.delay_days },
      { onConflict: 'campaign_id,step_number', ignoreDuplicates: false }
    )
    const { data: row } = await db.from('outreach_campaign_steps').select('id').eq('campaign_id', campaign.id).eq('step_number', s.step_number).single()
    stepIds[s.step_number] = row!.id
  }
  console.log(`Steps: ${stepSpec.length}`)

  // Step-1 per-channel overrides: a fire & security firm gets the fire & security
  // first-touch, not another sector's. Follow-ups stay generic.
  if (sectorTemplates.size > 0) {
    await db.from('outreach_step_template_overrides').upsert(
      [...sectorTemplates.entries()].map(([channel, templateId]) => ({ step_id: stepIds[1], channel, template_id: templateId })),
      { onConflict: 'step_id,channel', ignoreDuplicates: false }
    )
  }
  console.log(`Sector overrides on step 1: ${sectorTemplates.size}`)

  // Recipients (pending, due now) for each audience member.
  if (withEmail.length > 0) {
    const nowIso = new Date().toISOString()
    await db.from('outreach_recipients').upsert(
      withEmail.map((c) => ({ campaign_id: campaign.id, contact_id: c.id, status: 'pending', next_send_at: nowIso })),
      { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true }
    )
  }
  const { count } = await db.from('outreach_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id)
  console.log(`Recipients: ${count ?? 0}`)

  console.log('\nDone. Review the copy at /outreach, confirm Bright Fire Services are happy to be named, then start the campaign.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
