import { createClient } from '@/lib/supabase/server'
import type { BoardColumn } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getColumnsByWorkstream(
  workstreamId: string,
  client?: SupabaseClient
): Promise<BoardColumn[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('board_columns')
    .select('*')
    .eq('workstream_id', workstreamId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load board columns')
  }

  return (data ?? []) as BoardColumn[]
}

