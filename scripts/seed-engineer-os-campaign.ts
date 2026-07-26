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
 * NOTE ON TEMPLATES: the engine is a single linear sequence — one template per
 * step, sent to every recipient. This seed creates four sector first-touch
 * templates and wires the first three to the 3 steps as PLACEHOLDERS. Before
 * starting the campaign, Rob should finalise the step copy and decide sector
 * routing (either edit the wired templates, or split into per-sector campaigns).
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

const SECTOR_TEMPLATES = [
  { name: 'Engineer OS — Construction & building', subject: 'A quick idea for {{company}}' },
  { name: 'Engineer OS — Electrical, plumbing & HVAC', subject: 'A quick idea for {{company}}' },
  { name: 'Engineer OS — Facilities management', subject: 'A quick idea for {{company}}' },
  { name: 'Engineer OS — Fire & security', subject: 'A quick idea for {{company}}' },
]

const PLACEHOLDER_BODY = `<p>Hi {{email_greeting}},</p>
<p>I build software for field-service teams like {{company}}{{size_signal}}. [Replace this placeholder copy before starting the campaign.]</p>
<p>Worth a short call?</p>
<p>Rob</p>`

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
  const { data: contacts } = await db.from('contacts').select('id, email, tags').contains('tags', [AUDIENCE_TAG])
  const withEmail = (contacts ?? []).filter((c) => c.email && String(c.email).trim())
  if (withEmail.length > 0) {
    await db.from('outreach_audience_members')
      .upsert(withEmail.map((c) => ({ audience_id: audience.id, contact_id: c.id })), { onConflict: 'audience_id,contact_id', ignoreDuplicates: true })
  }
  console.log(`Audience: ${audience.id} — ${withEmail.length} members with email`)

  // Templates (four sectors).
  const templates: Array<{ id: string }> = []
  for (const t of SECTOR_TEMPLATES) {
    templates.push(await findOrCreate<{ id: string }>('outreach_templates', 'name', t.name, {
      name: t.name, subject: t.subject, body_html: PLACEHOLDER_BODY, body_text: null,
    }))
  }
  console.log(`Templates: ${templates.length}`)

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

  // Three steps at delays 0, 3, 8 (placeholder template wiring — see file header).
  const stepDelays = [0, 3, 8]
  for (let i = 0; i < stepDelays.length; i++) {
    await db.from('outreach_campaign_steps').upsert(
      { campaign_id: campaign.id, step_number: i + 1, template_id: templates[i].id, delay_days: stepDelays[i] },
      { onConflict: 'campaign_id,step_number', ignoreDuplicates: false }
    )
  }
  console.log(`Steps: ${stepDelays.length}`)

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
