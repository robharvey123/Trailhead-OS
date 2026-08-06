import { z } from 'zod'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import type { EngagementPeriodSpine } from './period-spine'

/**
 * Stage C — the AI writes PROSE around a fixed factual spine and cannot change
 * what is reported. Work items, hours, meetings and risks are rendered from the
 * spine directly (see pdf.tsx); the model only supplies commentary. `work_completed`
 * as model-authored task prose is gone.
 */
export const NarrativeSchema = z.object({
  executive_summary: z.string(),
  hours_commentary: z.string(),
  outlook: z.string(),
  risks_commentary: z.string(),
})
export type Narrative = z.infer<typeof NarrativeSchema>

export const EMPTY_NARRATIVE: Narrative = {
  executive_summary: '',
  hours_commentary: '',
  outlook: '',
  risks_commentary: '',
}

const SYSTEM_PROMPT = `You are writing the prose around a factual weekly/monthly consulting status report for a client.

The FACTS — work completed, work in progress, work scheduled next, slipped items, hours, meetings and risks — are fixed and are rendered separately from your prose, as lists. You are writing commentary only.

Audience: the end client's decision-maker. Wants to know value delivered.

You MAY write:
- executive_summary: 2-3 sentences, the consultant signing off on the period. Lead with outcomes.
- hours_commentary: a factual sentence or two on time used against the allowance.
- outlook: a short paragraph framing the period ahead.
- risks_commentary: a short paragraph framing risks, only if there are real risks.

You MUST NOT:
- add, remove, merge, rename or restate any work item. Do NOT list tasks — they are rendered from the data.
- state any number that is not in the facts provided. If you mention a count, hours or a date, use only the exact figures given. Prefer words ("two conversations") over digits where you can.
- use filler ("synergy", "leverage", "robust", "journey"). Never use em dashes.

If a field has nothing real to say, return an empty string for it. A short report backed by facts is correct — do not pad.

Return strict JSON and nothing else:
{ "executive_summary": string, "hours_commentary": string, "outlook": string, "risks_commentary": string }`

/** Compact, grounded facts for the model — descriptions are already client-safe. */
function buildPayload(spine: EngagementPeriodSpine) {
  const label = (t: { title: string; description: string | null }) => t.description || t.title
  return {
    engagement: spine.engagement.name,
    period: { from: spine.engagement.period_start, to: spine.engagement.period_end },
    completed: spine.completed.map(label),
    in_progress: spine.in_progress.map(label),
    scheduled_next: spine.scheduled_next.map(label),
    slipped: spine.slipped.map(label),
    counts: {
      completed: spine.completed.length,
      in_progress: spine.in_progress.length,
      scheduled_next: spine.scheduled_next.length,
      slipped: spine.slipped.length,
      meetings: spine.meetings.length,
      risks: spine.risks.length,
    },
    hours: spine.hours,
    tier1_movements: spine.tier1_movements,
    pipeline: spine.pipeline,
    meetings: spine.meetings.map((m) => ({ date: m.date, title: m.title })),
    risks: spine.risks.map((r) => ({ title: r.title, status: r.status })),
  }
}

// ── C3 validation gate: reject a narrative that cites a figure not in the spine ──
//
// Targeted, not blanket: a bare number can be a date ("4 September"), so we only
// flag numbers that CLAIM a quantity — "<n> tasks/meetings/…", "<n> hours", "<n>%".
// Those are the invention risk (e.g. "4 completed tasks" when the spine has 2).

const COUNT_NOUN = /\b(\d+)\s+(tasks?|items?|deliverables?|workstreams?|meetings?|calls?|risks?|accounts?|retailers?|listings?|conversations?|milestones?|reports?|distributors?)\b/gi
const HOURS_RE = /\b(\d+(?:\.\d+)?)\s*(?:h\b|hours?\b|hrs?\b)/gi
const PCT_RE = /\b(\d+)\s*%/g

/** Returns a rejection reason, or null if every quantity the narrative claims is in the spine. */
export function validateNarrative(narrative: Narrative, spine: EngagementPeriodSpine): string | null {
  // Work-item counts (any bucket) vs the specific meeting/risk counts, so
  // "4 meetings" is checked against the meeting count, not any coincidental figure.
  const taskCounts = new Set([spine.completed.length, spine.in_progress.length, spine.scheduled_next.length, spine.slipped.length].map(String))
  const meetingCount = String(spine.meetings.length)
  const riskCount = String(spine.risks.length)
  // Pipeline: distinct accounts total + per stage — validates "N accounts at X stage".
  const accountCounts = new Set<string>()
  const allPipelineAccounts = new Set<string>()
  for (const p of spine.pipeline) { accountCounts.add(String(p.accounts.length)); p.accounts.forEach((a) => allPipelineAccounts.add(a)) }
  accountCounts.add(String(allPipelineAccounts.size))

  const pct = new Set<string>()
  const hours = new Set<string>()
  const addHours = (n: number | null | undefined) => {
    if (n === null || n === undefined) return
    hours.add(String(n)); hours.add(Number(n).toFixed(1))
  }
  addHours(spine.hours.used_in_period)
  for (const m of spine.hours.months) {
    addHours(m.used); addHours(m.included); addHours(m.over)
    if (m.included && m.included > 0) pct.add(String(Math.round((m.used / m.included) * 100)))
  }

  const text = [narrative.executive_summary, narrative.hours_commentary, narrative.outlook, narrative.risks_commentary].join('  ')
  const bad: string[] = []
  let m: RegExpExecArray | null
  while ((m = COUNT_NOUN.exec(text))) {
    const noun = m[2].toLowerCase()
    const allowed = /meeting/.test(noun) ? new Set([meetingCount])
      : /risk/.test(noun) ? new Set([riskCount])
      : /account|retailer/.test(noun) ? accountCounts
      : taskCounts
    if (!allowed.has(m[1])) bad.push(`${m[1]} ${m[2]}`)
  }
  while ((m = HOURS_RE.exec(text))) { const v = m[1]; if (!hours.has(v) && !hours.has(Number(v).toFixed(1))) bad.push(`${v}h`) }
  while ((m = PCT_RE.exec(text))) if (!pct.has(m[1])) bad.push(`${m[1]}%`)

  return bad.length ? `cited figures not in the report facts: ${[...new Set(bad)].join(', ')}` : null
}

async function callClaude(spine: EngagementPeriodSpine, extra: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.SONNET,
    max_tokens: 1500,
    system: (SYSTEM_PROMPT + extra).trim(),
    messages: [{ role: 'user', content: JSON.stringify(buildPayload(spine)) }],
  })
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function parseNarrative(text: string): Narrative | null {
  const clean = text.replace(/^```json\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  try {
    const result = NarrativeSchema.safeParse(JSON.parse(clean))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Draft the prose from the spine. Validates against the spine's figures; on a
 * parse or validation miss, retries once telling the model exactly what was wrong.
 * On a second failure it THROWS the reason — the caller records it on
 * narrative_error and shows the review banner rather than shipping silent prose.
 */
export async function generateNarrative(spine: EngagementPeriodSpine): Promise<Narrative> {
  let reason = 'invalid JSON'
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt === 0 ? '' : `\n\nYour previous response was rejected: ${reason}. Return ONLY valid JSON matching the schema, and cite no number that is not in the facts you were given.`
    const parsed = parseNarrative(await callClaude(spine, extra))
    if (!parsed) { reason = 'the response was not valid JSON for the schema'; continue }
    const bad = validateNarrative(parsed, spine)
    if (bad) { reason = bad; continue }
    return parsed
  }
  throw new Error(`narrative rejected: ${reason}`)
}
