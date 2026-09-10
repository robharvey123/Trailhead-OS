import { createClient } from '@/lib/supabase/server'
import { currentPeriodHoursByEngagement, listEngagements } from './engagements'
import { getProjects } from './projects'
import type { EngagementStatus, EngagementType, ProjectStatus } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface EngagementHealth {
  id: string
  name: string
  client: string | null
  code: string | null
  status: EngagementStatus
  type: EngagementType
  currency: string
  includedHours: number | null
  retainer: number | null
  hoursUsed: number
  endDate: string | null
}

export interface ProjectHealth {
  id: string
  name: string
  status: ProjectStatus
  account: string | null
  workstream: string | null
  taskTotal: number
  taskDone: number
  nextMilestone: { name: string; date: string } | null
}

export interface PortfolioOverview {
  engagements: EngagementHealth[]
  projects: ProjectHealth[]
  counts: {
    engagementsActive: number
    projectsActive: number
    hoursThisMonth: number
    overCap: number
  }
}

const ENGAGEMENT_RANK: Record<EngagementStatus, number> = { Active: 0, Paused: 1, Draft: 2, Completed: 3, Terminated: 4 }
const PROJECT_ACTIVE: ProjectStatus[] = ['active', 'planning', 'on_hold']
const PROJECT_RANK: Record<string, number> = { active: 0, planning: 1, on_hold: 2 }

/**
 * Portfolio status for the dashboard: non-terminal engagements with this month's
 * hours against their allowance, and in-flight projects with task progress. Reuses
 * the existing list helpers and the engagement_hours_by_month rollup — no new query
 * shapes. Everything is RLS-scoped through the passed client.
 */
export async function getPortfolioOverview(client?: SupabaseClient): Promise<PortfolioOverview> {
  const supabase = client ?? (await createClient())
  const [engagements, projects] = await Promise.all([
    listEngagements({ excludeTerminal: true }, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
  ])
  // Each engagement's CURRENT billing month (its own start day, e.g. 15th to 14th).
  const periodHours = await currentPeriodHoursByEngagement(engagements, supabase).catch(() => new Map())

  const engHealth: EngagementHealth[] = engagements.map((e) => ({
    id: e.id,
    name: e.name,
    client: e.end_client?.name ?? null,
    code: e.code,
    status: e.status,
    type: e.engagement_type,
    currency: e.currency,
    includedHours: e.included_hours_monthly,
    retainer: e.retainer_amount_monthly,
    hoursUsed: periodHours.get(e.id)?.used ?? 0,
    endDate: e.end_date,
  }))
  engHealth.sort((a, b) => {
    const r = ENGAGEMENT_RANK[a.status] - ENGAGEMENT_RANK[b.status]
    if (r !== 0) return r
    // Within a status, surface the most time-pressured first.
    const ua = a.includedHours ? a.hoursUsed / a.includedHours : 0
    const ub = b.includedHours ? b.hoursUsed / b.includedHours : 0
    return ub - ua
  })

  const projHealth: ProjectHealth[] = projects
    .filter((p) => PROJECT_ACTIVE.includes(p.status))
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      account: p.account?.name ?? null,
      workstream: p.workstream?.label ?? null,
      taskTotal: p.task_count,
      taskDone: p.completed_task_count,
      nextMilestone: p.next_milestone ? { name: p.next_milestone.name, date: p.next_milestone.date } : null,
    }))
    .sort((a, b) => {
      const r = (PROJECT_RANK[a.status] ?? 9) - (PROJECT_RANK[b.status] ?? 9)
      if (r !== 0) return r
      const pa = a.taskTotal ? a.taskDone / a.taskTotal : 0
      const pb = b.taskTotal ? b.taskDone / b.taskTotal : 0
      return pa - pb // least complete first — those need attention
    })

  return {
    engagements: engHealth,
    projects: projHealth,
    counts: {
      engagementsActive: engHealth.filter((e) => e.status === 'Active').length,
      projectsActive: projHealth.filter((p) => p.status === 'active').length,
      hoursThisMonth: Math.round(engHealth.reduce((s, e) => s + e.hoursUsed, 0) * 10) / 10,
      overCap: engHealth.filter((e) => e.includedHours != null && e.hoursUsed > e.includedHours).length,
    },
  }
}
