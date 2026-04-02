import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/db/tasks'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const task = await createTask(
      {
        title,
        workstream_id: body.workstream_id ?? null,
        column_id: body.column_id ?? null,
        account_id: body.account_id ?? null,
        contact_id: body.contact_id ?? null,
        project_id: body.project_id ?? null,
        parent_task_id: body.parent_task_id ?? null,
        owner_user_id: user.id,
        description: body.description ?? null,
        status: body.status ?? 'todo',
        priority: body.priority ?? 'medium',
        owner: body.owner ?? null,
        start_date: body.start_date ?? null,
        due_date: body.due_date ?? null,
        due_time: body.due_time ?? null,
        estimated_hours: body.estimated_hours ?? null,
        actual_hours: body.actual_hours ?? null,
        is_master_todo: body.is_master_todo ?? false,
        tags: Array.isArray(body.tags) ? body.tags : [],
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
        order_index: typeof body.order_index === 'number' ? body.order_index : 0,
        custom_fields: typeof body.custom_fields === 'object' && body.custom_fields ? body.custom_fields : {},
      },
      supabase
    )

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
