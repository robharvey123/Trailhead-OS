import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { normalizeWorkspaceTaskCategory } from '@/lib/workspace/constants'
import { parseChecklistItems, parseHexColor, parseTime } from '@/lib/workspace/task-payload'

const PRIORITIES = new Set(['low', 'medium', 'high'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    patch.title = title
  }
  if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null
  if (body.category !== undefined) {
    if (body.category === null || body.category === '') { patch.category = null }
    else {
      const cat = normalizeWorkspaceTaskCategory(body.category)
      if (!cat) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      patch.category = cat
    }
  }
  if (body.planned_start_time !== undefined) {
    if (body.planned_start_time === null || body.planned_start_time === '') { patch.planned_start_time = null }
    else {
      const t = parseTime(body.planned_start_time)
      if (!t) return NextResponse.json({ error: 'planned_start_time must be HH:MM or HH:MM:SS' }, { status: 400 })
      patch.planned_start_time = t
    }
  }
  if (body.task_color !== undefined) {
    if (body.task_color === null || body.task_color === '') { patch.task_color = null }
    else {
      const c = parseHexColor(body.task_color)
      if (!c) return NextResponse.json({ error: 'task_color must be a hex color' }, { status: 400 })
      patch.task_color = c
    }
  }
  if (body.duration_minutes !== undefined) {
    const d = Number(body.duration_minutes)
    if (!Number.isFinite(d) || d <= 0) return NextResponse.json({ error: 'duration_minutes must be > 0' }, { status: 400 })
    patch.duration_minutes = Math.round(d)
  }
  if (body.required_people !== undefined) {
    const rp = Number(body.required_people)
    if (!Number.isFinite(rp) || rp <= 0) return NextResponse.json({ error: 'required_people must be > 0' }, { status: 400 })
    patch.required_people = Math.round(rp)
  }
  if (body.priority !== undefined) {
    const p = String(body.priority || '').toLowerCase()
    if (!PRIORITIES.has(p)) return NextResponse.json({ error: 'priority must be low, medium or high' }, { status: 400 })
    patch.priority = p
  }
  if (body.checklist_items !== undefined) {
    const cl = parseChecklistItems(body.checklist_items)
    if (cl === null) return NextResponse.json({ error: 'checklist_items must be an array' }, { status: 400 })
    patch.checklist_items = cl
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })

  const result = await supabase.from('workspace_task_templates').update(patch).eq('id', id).eq('workspace_id', workspaceId).select('*').single()
  if (result.error) {
    const status = result.error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: result.error.message }, { status })
  }
  return NextResponse.json({ template: result.data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  const result = await supabase.from('workspace_task_templates').delete().eq('id', id).eq('workspace_id', workspaceId).select('id').single()
  if (result.error) {
    const status = result.error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: result.error.message }, { status })
  }
  return NextResponse.json({ deletedTemplateId: result.data.id })
}
