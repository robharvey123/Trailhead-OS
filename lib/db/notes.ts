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
