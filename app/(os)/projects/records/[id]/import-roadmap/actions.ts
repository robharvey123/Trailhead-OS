'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { fileToMarkdown, extractRoadmap } from '@/lib/roadmap/extract'
import { RoadmapExtractionSchema } from '@/lib/roadmap/schema'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_IMPORTS_PER_DAY = 5

/** Upload a roadmap doc, extract tasks via the LLM, persist a pending import. */
export async function extractRoadmapImport(
  projectId: string,
  formData: FormData
): Promise<{ importId?: string; error?: string }> {
  const supabase = await createClient()
  let admin
  try {
    admin = await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file provided.' }
  if (file.size > MAX_FILE_BYTES) return { error: 'File too large (max 15MB).' }
  if (!/\.(docx|md)$/i.test(file.name)) return { error: 'Only .docx or .md files are supported.' }

  // Per-project rate limit to prevent accidental loops.
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('roadmap_imports')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .gte('created_at', startOfDay.toISOString())
  if ((count ?? 0) >= MAX_IMPORTS_PER_DAY) {
    return { error: `Import limit reached for this project today (${MAX_IMPORTS_PER_DAY}/day).` }
  }

  const buf = Buffer.from(await file.arrayBuffer())

  // Archive the source (private bucket). Non-fatal if it fails — extraction still proceeds.
  const path = `${projectId}/${randomUUID()}-${file.name}`
  const { error: upErr } = await supabase.storage
    .from('roadmap-imports')
    .upload(path, buf, { contentType: file.type || undefined, upsert: false })

  let markdown: string
  try {
    markdown = await fileToMarkdown(file.name, buf)
  } catch {
    return { error: 'Could not read the document.' }
  }

  let extraction
  try {
    extraction = await extractRoadmap(markdown)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Extraction failed.' }
  }

  const { data: project } = await supabase.from('projects').select('engagement_id').eq('id', projectId).maybeSingle()

  const { data: row, error: insErr } = await supabase
    .from('roadmap_imports')
    .insert({
      project_id: projectId,
      engagement_id: project?.engagement_id ?? null,
      source_filename: file.name,
      source_file_path: upErr ? null : path,
      extracted_json: extraction,
      status: 'pending',
      created_by: admin.id,
    })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }

  return { importId: row.id }
}

/** Commit the user-edited task set as engagement_tasks on the project's engagement. */
export async function commitRoadmapImport(
  importId: string,
  committedRaw: unknown
): Promise<{ error?: string }> {
  const supabase = await createClient()
  let admin
  try {
    admin = await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }

  const parsed = RoadmapExtractionSchema.safeParse(committedRaw)
  if (!parsed.success) return { error: 'The edited task data is invalid — please review and try again.' }
  const committed = parsed.data

  const { data: imp } = await supabase
    .from('roadmap_imports')
    .select('id, project_id, engagement_id, status')
    .eq('id', importId)
    .maybeSingle()
  if (!imp) return { error: 'Import not found.' }
  if (imp.status === 'committed') return { error: 'This import has already been committed.' }
  if (!imp.engagement_id) return { error: 'Link this project to an engagement before committing tasks.' }

  // Own bulk-insert (not the single-task action): admin-gated, milestone-as-label.
  let position = 0
  const rows = committed.milestones.flatMap((m) =>
    m.tasks.map((t) => ({
      engagement_id: imp.engagement_id,
      project_id: imp.project_id,
      title: t.title,
      description: t.description ?? null,
      status: 'backlog' as const,
      priority: t.priority,
      reporter_person_id: admin.person_id,
      due_date: t.suggested_due_date ?? null, // user accepted the suggestion by committing
      labels: Array.from(new Set([m.name, ...t.labels])),
      position: position++,
    }))
  )
  if (rows.length === 0) return { error: 'No tasks to create.' }

  const { error: insErr } = await supabase.from('engagement_tasks').insert(rows)
  if (insErr) return { error: insErr.message }

  await supabase
    .from('roadmap_imports')
    .update({
      status: 'committed',
      committed_json: committed,
      task_count_committed: rows.length,
      committed_at: new Date().toISOString(),
    })
    .eq('id', importId)

  revalidatePath('/my-work')
  revalidatePath(`/engagements/${imp.engagement_id}/tasks`)
  redirect(`/engagements/${imp.engagement_id}/tasks`)
}
