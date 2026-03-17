import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { normalizeWorkspaceTaskCategory } from '@/lib/workspace/constants'
import { parseChecklistItems, parseHexColor, parseTime } from '@/lib/workspace/task-payload'

const PRIORITIES = new Set(['low', 'medium', 'high'])

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const result = await supabase
    .from('workspace_task_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('title', { ascending: true })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ templates: result.data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const workspaceId = String(body.workspace_id || '').trim()

  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const title = String(body.title || '').trim()
  const description = body.description ? String(body.description).trim() : null
  const durationMinutes = Number(body.duration_minutes || 60)
  const requiredPeople = Number(body.required_people || 1)
  const priority = String(body.priority || 'medium').toLowerCase()
  const category = body.category === undefined ? null : normalizeWorkspaceTaskCategory(body.category)
  const plannedStartTime = body.planned_start_time === undefined ? null : parseTime(body.planned_start_time)
  const taskColor = body.task_color === undefined ? null : parseHexColor(body.task_color)
  const checklistItems = parseChecklistItems(body.checklist_items)

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return NextResponse.json({ error: 'duration_minutes must be > 0' }, { status: 400 })
  if (!Number.isFinite(requiredPeople) || requiredPeople <= 0) return NextResponse.json({ error: 'required_people must be > 0' }, { status: 400 })
  if (!PRIORITIES.has(priority)) return NextResponse.json({ error: 'priority must be low, medium or high' }, { status: 400 })
  if (body.category !== undefined && body.category !== null && body.category !== '' && !category) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (checklistItems === null) return NextResponse.json({ error: 'checklist_items must be an array' }, { status: 400 })

  const result = await supabase
    .from('workspace_task_templates')
    .insert({
      workspace_id: workspaceId,
      title, description, category,
      planned_start_time: plannedStartTime,
      task_color: taskColor,
      duration_minutes: Math.round(durationMinutes),
      required_people: Math.round(requiredPeople),
      priority,
      checklist_items: checklistItems,
      created_by: userId,
    })
    .select('*')
    .single()

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ template: result.data })
}
