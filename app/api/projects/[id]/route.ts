import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { archiveProject, deleteProject, getProjectById, updateProject } from '@/lib/db/projects'
import type { ProjectStatus } from '@/lib/types'

const PROJECT_STATUSES = new Set<ProjectStatus>([
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
])

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const project = await getProjectById(id, auth.supabase)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load project' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = sanitizeText(body.name)
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    patch.name = name
  }

  if (body.workstream_id !== undefined) {
    patch.workstream_id = typeof body.workstream_id === 'string' ? body.workstream_id : null
  }

  if (body.account_id !== undefined) {
    patch.account_id = typeof body.account_id === 'string' ? body.account_id : null
  }

  if (body.engagement_id !== undefined) {
    patch.engagement_id = typeof body.engagement_id === 'string' && body.engagement_id ? body.engagement_id : null
  }

  if (body.owner_id !== undefined) {
    patch.owner_id = typeof body.owner_id === 'string' ? body.owner_id : null
  }

  if (body.pricing_tier_id !== undefined) {
    patch.pricing_tier_id = typeof body.pricing_tier_id === 'string' ? body.pricing_tier_id : null
  }

  if (body.description !== undefined) patch.description = sanitizeText(body.description)
  if (body.brief !== undefined) patch.brief = sanitizeText(body.brief)
  if (body.start_date !== undefined) patch.start_date = typeof body.start_date === 'string' ? body.start_date : null
  if (body.end_date !== undefined) patch.end_date = typeof body.end_date === 'string' ? body.end_date : null
  if (body.estimated_end_date !== undefined) {
    patch.estimated_end_date = typeof body.estimated_end_date === 'string' ? body.estimated_end_date : null
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !PROJECT_STATUSES.has(body.status as ProjectStatus)) {
      return NextResponse.json({ error: 'Invalid project status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  // Capture the old engagement so a link change can revalidate both sides' Projects lists.
  let oldEngagementId: string | null = null
  if (patch.engagement_id !== undefined) {
    const { data: prev } = await auth.supabase.from('projects').select('engagement_id').eq('id', id).maybeSingle()
    oldEngagementId = (prev?.engagement_id as string | null) ?? null
  }

  try {
    const project = await updateProject(id, patch, auth.supabase)

    revalidatePath('/projects')
    revalidatePath(`/projects/records/${id}`)
    if (patch.engagement_id !== undefined) {
      const newEngagementId = (patch.engagement_id as string | null) ?? null
      for (const eid of new Set([oldEngagementId, newEngagementId])) {
        if (eid) revalidatePath(`/engagements/${eid}`)
      }
    }

    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params
  const hardDelete = request.nextUrl.searchParams.get('hard') === 'true'
  const cascade = request.nextUrl.searchParams.get('cascade') === 'true'

  try {
    if (hardDelete) {
      if (cascade) {
        await auth.supabase.from('tasks').delete().eq('project_id', id)
      }
      await deleteProject(id, auth.supabase)
      return NextResponse.json({ deleted: true })
    }

    const project = await archiveProject(id, auth.supabase)
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : hardDelete ? 'Failed to delete project' : 'Failed to archive project' },
      { status: 500 }
    )
  }
}