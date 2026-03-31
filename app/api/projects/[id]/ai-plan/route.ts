import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getProjectById } from '@/lib/db/projects'
import { planProjectFromBrief } from '@/lib/project-planner'

export async function POST(
  _request: Request,
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

    if (project.ai_planned) {
      return NextResponse.json({ error: 'Project has already been AI planned' }, { status: 400 })
    }

    if (!project.workstream_id) {
      return NextResponse.json({ error: 'Project must belong to a workstream before AI planning' }, { status: 400 })
    }

    const brief = (project.brief ?? project.description ?? '').trim()
    if (!brief) {
      return NextResponse.json({ error: 'Add a project brief before running AI planning' }, { status: 400 })
    }

    const planning = await planProjectFromBrief({
      projectId: project.id,
      projectName: project.title || project.name,
      workstreamId: project.workstream_id,
      pricingTierId: project.pricing_tier_id ?? null,
      startDate: project.start_date ?? new Date().toISOString().slice(0, 10),
      brief,
    })

    return NextResponse.json({ planning })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to AI plan project' },
      { status: 500 }
    )
  }
}