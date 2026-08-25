import { createClient } from '@/lib/supabase/service'

/**
 * Engine-generated tasks land in engagement_tasks — the canonical system the
 * /tasks views render — tagged with the 'seo-engine' label so they're
 * filterable. engagement_id stays null (admin-only visibility under the RLS
 * rules, which is right for a single-operator module).
 *
 * D4 rule: every task description must stand alone when read a week later
 * with no memory of why it appeared. `context` carries the evidence and
 * `url` the object; `renderTaskDescription` turns them into a description
 * that answers what, why now, what is the evidence, and what is the first step.
 */

export const ENGINE_LABEL = 'seo-engine'

export interface EngineTaskContext {
  /** What is wrong / what the opportunity is, in one sentence. */
  what?: string
  /** Why now — the trigger, with its measurement window. */
  why?: string
  /** Evidence lines — numbers, queries, URLs. */
  evidence?: string[]
  /** Expected gain, labelled as an estimate where it is one. */
  gain?: string
  /** The first click / the first thing to do. */
  firstStep?: string
  /** A destination inside the OS (worksheet, gap view, paid tab). */
  link?: string
}

export interface EngineTaskInput {
  title: string
  description?: string
  /** The object of the task — a page, a query, a campaign. */
  url?: string
  context?: EngineTaskContext
  dueDate?: string // YYYY-MM-DD
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  extraLabels?: string[]
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')
}

/** Description that reads as a self-contained note. */
export function renderTaskDescription(input: EngineTaskInput): string {
  const lines: string[] = []
  if (input.url) lines.push(`Object: ${input.url}`)
  const c = input.context
  if (c?.what) lines.push(c.what)
  if (c?.why) lines.push(`Why now: ${c.why}`)
  if (c?.evidence && c.evidence.length > 0) {
    lines.push('Evidence:')
    for (const e of c.evidence) lines.push(`- ${e}`)
  }
  if (c?.gain) lines.push(`Expected gain: ${c.gain}`)
  if (c?.firstStep) lines.push(`First step: ${c.firstStep}`)
  if (c?.link) lines.push(`Open: ${c.link.startsWith('http') ? c.link : `${appBaseUrl()}${c.link}`}`)
  if (input.description) lines.push(input.description)
  return lines.join('\n')
}

/** Create an engine task unless an open one with the same title already exists
 *  (the dedupe rule that keeps nightly generation idempotent). */
export async function createEngineTaskOnce(input: EngineTaskInput): Promise<boolean> {
  const supabase = createClient()

  const { data: existing, error: findError } = await supabase
    .from('engagement_tasks')
    .select('id')
    .eq('title', input.title)
    .contains('labels', [ENGINE_LABEL])
    .not('status', 'in', '(done,cancelled)')
    .limit(1)
  if (findError) throw new Error(findError.message)
  if (existing && existing.length > 0) return false

  const description = input.context || input.url ? renderTaskDescription(input) : input.description ?? null

  const { error } = await supabase.from('engagement_tasks').insert({
    title: input.title,
    description,
    due_date: input.dueDate ?? null,
    priority: input.priority ?? 'normal',
    labels: [ENGINE_LABEL, ...(input.extraLabels ?? [])],
  })
  if (error) throw new Error(error.message)
  return true
}
