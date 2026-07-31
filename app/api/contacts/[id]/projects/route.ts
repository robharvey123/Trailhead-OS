import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { addContactToProject, removeContactFromProject } from '@/lib/db/projects'

// POST { project_id } — explicitly link a project to this contact.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const projectId = typeof body.project_id === 'string' ? body.project_id : ''
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  try {
    await addContactToProject(projectId, id, undefined, auth.supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to link project' }, { status: 500 })
  }
}

// DELETE ?project_id= — remove an explicit project link.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  const { id } = await params
  const projectId = request.nextUrl.searchParams.get('project_id') ?? ''
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  try {
    await removeContactFromProject(projectId, id, auth.supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to unlink project' }, { status: 500 })
  }
}
