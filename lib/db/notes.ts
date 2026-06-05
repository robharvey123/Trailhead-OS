import { createClient } from '@/lib/supabase/server'
import type { Note, NoteWithWorkstream, Workstream } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type NoteRowWithJoin = Note & {
  workstreams: Pick<Workstream, 'slug' | 'label' | 'colour'> | null
  tasks: { title: string } | null
}

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapNote(row: NoteRowWithJoin): NoteWithWorkstream {
  return {
    id: row.id,
    workstream_id: row.workstream_id,
    task_id: row.task_id,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    workstream_slug: row.workstreams?.slug ?? null,
    workstream_label: row.workstreams?.label ?? null,
    workstream_colour: row.workstreams?.colour ?? null,
    task_title: row.tasks?.title ?? null,
  }
}

export async function getRecentNotes(
  limit = 3,
  client?: SupabaseClient
): Promise<NoteWithWorkstream[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('notes')
    .select('*, workstreams(slug, label, colour), tasks(title)')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to load notes')
  }

  return ((data ?? []) as NoteRowWithJoin[]).map(mapNote)
}

/** Input for {@link addNote}. At least one of workstream_id / task_id should be set. */
export interface AddNoteInput {
  workstream_id?: string | null
  task_id?: string | null
  title?: string | null
  body?: string | null
}

/**
 * Create a note attached to a workstream and/or a task. Backs the MCP
 * `add_note` tool.
 *
 * NOTE: the `notes` table only has `workstream_id` and `task_id` columns — there
 * is no `project_id`, so project-scoped notes are not supported here without a
 * schema change (see KNOWN_HARDENING.md).
 */
export async function addNote(
  input: AddNoteInput,
  client?: SupabaseClient
): Promise<Note> {
  const title = input.title?.trim() || null
  const body = input.body?.trim() || null

  if (!title && !body) {
    throw new Error('A note needs a title or a body')
  }

  if (!input.workstream_id && !input.task_id) {
    throw new Error('A note needs a workstream_id or a task_id to attach to')
  }

  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('notes')
    .insert({
      workstream_id: input.workstream_id ?? null,
      task_id: input.task_id ?? null,
      title,
      body,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create note')
  }

  return data as Note
}

export async function getNotesByTaskId(
  taskId: string,
  client?: SupabaseClient
): Promise<NoteWithWorkstream[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('notes')
    .select('*, workstreams(slug, label, colour), tasks(title)')
    .eq('task_id', taskId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Failed to load task notes')
  }

  return ((data ?? []) as NoteRowWithJoin[]).map(mapNote)
}
