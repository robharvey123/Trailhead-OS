import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getColumnsByWorkstream } from '@/lib/db/columns'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import type { Workstream, WorkstreamSummary } from '@/lib/types'

const ALLOWED_COLOURS = new Set(['teal', 'amber', 'purple', 'green', 'coral', 'blue'])
const DEFAULT_COLUMNS = [
  { label: 'Backlog', sort_order: 0 },
  { label: 'In progress', sort_order: 1 },
  { label: 'Review', sort_order: 2 },
  { label: 'Done', sort_order: 3 },
]

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const workstreams = await getWorkstreams(supabase)
    const now = new Date()
    const weekAhead = new Date(now)
    weekAhead.setDate(weekAhead.getDate() + 7)

    const summaries = await Promise.all(
      workstreams.map(async (workstream): Promise<WorkstreamSummary> => {
        const [columns, tasks, dueThisWeek] = await Promise.all([
          getColumnsByWorkstream(workstream.id, supabase),
          getTasks({ workstream_id: workstream.id, include_completed: true }, supabase),
          getTasks(
            {
              workstream_id: workstream.id,
              due_date_from: formatDate(now),
              due_date_to: formatDate(weekAhead),
            },
            supabase
          ),
        ])

        const columnCounts = columns.map((column) => ({
          column_id: column.id,
          label: column.label,
          task_count: tasks.filter((task) => task.column_id === column.id && !task.completed_at).length,
        }))

        const lastUpdated = tasks
          .map((task) => task.updated_at)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

        return {
          ...workstream,
          column_counts: columnCounts,
          due_this_week_count: dueThisWeek.length,
          last_updated: lastUpdated,
        }
      })
    )

    return NextResponse.json({ workstreams: summaries })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load workstreams' },
      { status: 500 }
    )
  }
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const label = sanitizeText(body.label)
  const slug = normalizeSlug(sanitizeText(body.slug))
  const colour = sanitizeText(body.colour)
  const sortOrderValue =
    typeof body.sort_order === 'number' ? body.sort_order : Number.parseInt(String(body.sort_order ?? ''), 10)

  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  if (!ALLOWED_COLOURS.has(colour)) {
    return NextResponse.json(
      { error: `colour must be one of: ${Array.from(ALLOWED_COLOURS).join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const { data: existingWorkstream } = await supabase
      .from('workstreams')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingWorkstream) {
      return NextResponse.json({ error: 'A workstream with this slug already exists' }, { status: 409 })
    }

    let nextSortOrder = sortOrderValue
    if (!Number.isFinite(nextSortOrder)) {
      const { data: latestWorkstream } = await supabase
        .from('workstreams')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      nextSortOrder = (latestWorkstream?.sort_order ?? 0) + 1
    }

    const { data: workstream, error: insertError } = await supabase
      .from('workstreams')
      .insert({
        slug,
        label,
        colour,
        sort_order: nextSortOrder,
      })
      .select('*')
      .single<Workstream>()

    if (insertError || !workstream) {
      throw new Error(insertError?.message || 'Failed to create workstream')
    }

    const { error: columnsError } = await supabase.from('board_columns').insert(
      DEFAULT_COLUMNS.map((column) => ({
        workstream_id: workstream.id,
        label: column.label,
        sort_order: column.sort_order,
      }))
    )

    if (columnsError) {
      await supabase.from('workstreams').delete().eq('id', workstream.id)
      throw new Error(columnsError.message || 'Failed to create board columns')
    }

    return NextResponse.json({ workstream }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workstream' },
      { status: 500 }
    )
  }
}
