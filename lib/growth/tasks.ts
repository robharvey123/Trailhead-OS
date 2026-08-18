import { createClient } from '@/lib/supabase/service'

/**
 * Engine-generated tasks land in engagement_tasks — the canonical system the
 * /tasks views render — tagged with the 'seo-engine' label so they're
 * filterable. engagement_id stays null (admin-only visibility under the RLS
 * rules, which is right for a single-operator module).
 */

export const ENGINE_LABEL = 'seo-engine'

export interface EngineTaskInput {
  title: string
  description?: string
  dueDate?: string // YYYY-MM-DD
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  extraLabels?: string[]
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

  const { error } = await supabase.from('engagement_tasks').insert({
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
    priority: input.priority ?? 'normal',
    labels: [ENGINE_LABEL, ...(input.extraLabels ?? [])],
  })
  if (error) throw new Error(error.message)
  return true
}
