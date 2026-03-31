import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createProject } from '@/lib/db/projects'
import { getQuoteById, updateQuote } from '@/lib/db/quotes'
import { planProjectFromBrief } from '@/lib/project-planner'

function buildPlanningBrief(quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>>) {
  const sections = [
    quote.summary,
    quote.final_content?.overview,
    quote.final_content?.approach,
    quote.draft_content?.overview,
    quote.draft_content?.approach,
    quote.scope.length > 0
      ? `Scope:\n${quote.scope
          .map((phase) => `${phase.phase}: ${phase.description}${phase.deliverables.length ? `\nDeliverables: ${phase.deliverables.join(', ')}` : ''}`)
          .join('\n\n')}`
      : null,
    quote.notes,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join('\n\n')

  return sections.trim()
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const aiPlan = body.ai_plan !== false

  try {
    const quote = await getQuoteById(id, auth.supabase)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.project_id) {
      return NextResponse.json({ project_id: quote.project_id, already_linked: true })
    }

    if (quote.status !== 'accepted' && quote.status !== 'converted') {
      return NextResponse.json(
        { error: 'Only accepted or converted quotes can be turned into projects' },
        { status: 400 }
      )
    }

    if (!quote.workstream_id) {
      return NextResponse.json({ error: 'Quote must have a workstream before creating a project' }, { status: 400 })
    }

    const project = await createProject(
      {
        workstream_id: quote.workstream_id,
        account_id: quote.account_id ?? null,
        pricing_tier_id: quote.pricing_tier_id ?? null,
        name: quote.title,
        description: quote.summary ?? quote.final_content?.overview ?? quote.draft_content?.overview ?? null,
        brief: buildPlanningBrief(quote) || quote.title,
        status: 'planning',
        start_date: new Date().toISOString().slice(0, 10),
        estimated_end_date: quote.valid_until ?? null,
      },
      auth.supabase
    )

    await updateQuote(
      quote.id,
      {
        project_id: project.id,
      },
      auth.supabase
    )

    let planningResult: Awaited<ReturnType<typeof planProjectFromBrief>> | null = null
    const planningBrief = buildPlanningBrief(quote)

    if (aiPlan && planningBrief) {
      planningResult = await planProjectFromBrief({
        projectId: project.id,
        projectName: project.name,
        workstreamId: quote.workstream_id,
        pricingTierId: quote.pricing_tier_id ?? null,
        startDate: project.start_date ?? new Date().toISOString().slice(0, 10),
        brief: planningBrief,
      })
    }

    return NextResponse.json({
      project_id: project.id,
      ai_planned: Boolean(planningResult),
      planning: planningResult,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project from quote' },
      { status: 500 }
    )
  }
}