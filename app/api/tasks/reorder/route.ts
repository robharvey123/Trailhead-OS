import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { reorderTasks } from '@/lib/db/tasks'
import type { ReorderTaskUpdate } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const rawUpdates = Array.isArray(body) ? body : body.updates

  if (!Array.isArray(rawUpdates) || rawUpdates.length === 0) {
    return NextResponse.json({ error: 'updates must be a non-empty array' }, { status: 400 })
  }

  const updates: ReorderTaskUpdate[] = []

  for (const entry of rawUpdates) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      typeof entry.sort_order !== 'number' ||
      (entry.column_id !== undefined && entry.column_id !== null && typeof entry.column_id !== 'string')
    ) {
      return NextResponse.json(
        { error: 'Each update must include id, sort_order, and an optional column_id' },
        { status: 400 }
      )
    }

    updates.push({
      id: entry.id,
      sort_order: entry.sort_order,
      column_id: entry.column_id ?? null,
    })
  }

  try {
    await reorderTasks(updates, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder tasks' },
      { status: 500 }
    )
  }
}
