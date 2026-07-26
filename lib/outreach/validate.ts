import type { SupabaseClient } from '@supabase/supabase-js'
import { renderTemplate, OUTREACH_TEMPLATE_VARS } from './render'

// A probe map with every supported var present, so validation only trips on an
// UNKNOWN token, not on a legitimately-empty value.
const PROBE: Record<string, string> = Object.fromEntries(OUTREACH_TEMPLATE_VARS.map((k) => [k, 'sample']))

/**
 * Validate a campaign's templates before it can start: every step needs a
 * template, no template may still contain placeholder copy ("[Replace"), and
 * every merge tag must be a supported var. Returns an error message (shown on the
 * button) or null when the campaign is safe to run. Checks per-channel overrides too.
 */
export async function validateCampaignForSend(db: SupabaseClient, campaignId: string): Promise<string | null> {
  const { data: steps } = await db
    .from('outreach_campaign_steps')
    .select('id, step_number, template_id')
    .eq('campaign_id', campaignId)
    .order('step_number', { ascending: true })
  if (!steps || steps.length === 0) return 'Add at least one step before starting.'

  for (const step of steps as Array<{ id: string; step_number: number; template_id: string | null }>) {
    const { data: overrides } = await db.from('outreach_step_template_overrides').select('template_id').eq('step_id', step.id)
    const ids = [step.template_id, ...((overrides ?? []) as Array<{ template_id: string }>).map((o) => o.template_id)].filter(Boolean) as string[]
    if (ids.length === 0) return `Step ${step.step_number} has no template.`

    const { data: templates } = await db.from('outreach_templates').select('id, name, subject, body_html').in('id', ids)
    for (const t of (templates ?? []) as Array<{ name: string; subject: string | null; body_html: string | null }>) {
      const subject = t.subject ?? ''
      const body = t.body_html ?? ''
      if (subject.includes('[Replace') || body.includes('[Replace')) return `Template “${t.name}” still contains placeholder copy.`
      try {
        renderTemplate(subject, PROBE, { escape: false })
        renderTemplate(body, PROBE)
      } catch (e) {
        return `Template “${t.name}”: ${e instanceof Error ? e.message : 'invalid merge tag'}`
      }
    }
  }
  return null
}
