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
 * per-channel overrides (one per distinct contact.channel) so each sector gets its
 * own cold open; steps 2 and 3 are generic follow-ups. All bodies are placeholders
 * containing "[Replace" — the campaign is blocked from going `running` until Rob
 * writes real copy (validateCampaignForSend enforces this at the Start button).
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

// Placeholder bodies deliberately keep the "[Replace" marker: the campaign cannot
// go to `running` while any template still contains it (validateCampaignForSend),
// so Rob must write real copy first. Note the separator inside the parentheses.
function placeholderBody(kind: string) {
  return `<p>Hi {{email_greeting}},</p>
<p>I build software for field-service teams like {{company}} ({{size_signal}}). [Replace this ${kind} copy before starting the campaign.]</p>
<p>Worth a short call?</p>
<p>Rob</p>`
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

  // Templates: one default first-touch (step-1 fallback), one per distinct
  // sector (channel) for the step-1 override, and two generic follow-ups.
  const channels = [...new Set(withEmail.map((c) => String(c.channel ?? '').trim()).filter(Boolean))]
  const firstTouch = await findOrCreate<{ id: string }>('outreach_templates', 'name', DEFAULT_FIRST_TOUCH, {
    name: DEFAULT_FIRST_TOUCH, subject: 'A quick idea for {{company}}', body_html: placeholderBody('default first-touch'), body_text: null,
  })
  const followup1 = await findOrCreate<{ id: string }>('outreach_templates', 'name', FOLLOWUP_1, {
    name: FOLLOWUP_1, subject: 'Re: a quick idea for {{company}}', body_html: placeholderBody('follow-up'), body_text: null,
  })
  const followup2 = await findOrCreate<{ id: string }>('outreach_templates', 'name', FOLLOWUP_2, {
    name: FOLLOWUP_2, subject: 'Re: a quick idea for {{company}}', body_html: placeholderBody('final follow-up'), body_text: null,
  })
  const sectorTemplates = new Map<string, string>()
  for (const channel of channels) {
    const t = await findOrCreate<{ id: string }>('outreach_templates', 'name', `Engineer OS — ${channel}`, {
      name: `Engineer OS — ${channel}`, subject: 'A quick idea for {{company}}', body_html: placeholderBody(`${channel} first-touch`), body_text: null,
    })
    sectorTemplates.set(channel, t.id)
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
    { step_number: 1, template_id: firstTouch.id, delay_days: 0 },
    { step_number: 2, template_id: followup1.id, delay_days: 3 },
    { step_number: 3, template_id: followup2.id, delay_days: 5 },
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

  console.log('\nDone. Review the placeholder templates and start the campaign from /outreach.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
