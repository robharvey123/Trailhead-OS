import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createProject, getProjects } from '@/lib/db/projects'
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

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const projects = await getProjects(
      {
        workstream_id: searchParams.get('workstream_id') ?? undefined,
        account_id: searchParams.get('account_id') ?? undefined,
        contact_id: searchParams.get('contact_id') ?? undefined,
        status:
          status && PROJECT_STATUSES.has(status as ProjectStatus)
            ? (status as ProjectStatus)
            : undefined,
        search: searchParams.get('search') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ projects })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load projects' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const name = sanitizeText(body.name) ?? ''
  const workstreamId = typeof body.workstream_id === 'string' ? body.workstream_id : ''
  const status =
    typeof body.status === 'string' && PROJECT_STATUSES.has(body.status as ProjectStatus)
      ? (body.status as ProjectStatus)
      : 'planning'

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!workstreamId) {
    return NextResponse.json({ error: 'workstream_id is required' }, { status: 400 })
  }

  try {
    const project = await createProject(
      {
        name,
        workstream_id: workstreamId,
        account_id: typeof body.account_id === 'string' ? body.account_id : null,
        owner_id: typeof body.owner_id === 'string' ? body.owner_id : null,
        pricing_tier_id: typeof body.pricing_tier_id === 'string' ? body.pricing_tier_id : null,
        description: sanitizeText(body.description),
        brief: sanitizeText(body.brief),
        status,
        start_date: typeof body.start_date === 'string' ? body.start_date : null,
        end_date: typeof body.end_date === 'string' ? body.end_date : null,
        estimated_end_date:
          typeof body.estimated_end_date === 'string' ? body.estimated_end_date : null,
      },
      auth.supabase
    )

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}