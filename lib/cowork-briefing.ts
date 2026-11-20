import { addDays, startOfDayIso, todayDate } from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'
import { listEngagements, engagementHoursThisMonth } from '@/lib/db/engagements'
import { daysLeftInPeriod } from '@/lib/engagements/periods'
import { calculateTotals, type LineItem } from '@/lib/types'

type ServerClient = Parameters<typeof listEngagements>[1]
const svc = supabaseService as unknown as ServerClient

const RENEWAL_WINDOW_DAYS = 45

// Tasks come from engagement_tasks, the canonical table behind /tasks. The brief
// used to read the legacy `tasks` table, frozen since October 2026, so it missed
// every live task. Scope: the owner's tasks plus unassigned ones (most tasks carry
// no assignee). Overdue is capped so a long backlog can't swamp the brief; the
// full count is returned alongside.
const BRIEF_TASK_SELECT = 'id, title, priority, status, due_date, engagement:engagements(id, name), project:projects(id, name)'
const OVERDUE_LIMIT = 25

type BriefTaskRow = {
  id: string
  title: string
  priority: string
  status: string
  due_date: string | null
  engagement: { id: string; name: string } | { id: string; name: string }[] | null
  project: { id: string; name: string } | { id: string; name: string }[] | null
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatBriefTask(row: BriefTaskRow) {
  const engagement = one(row.engagement)
  const project = one(row.project)
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    due_date: row.due_date,
    engagement: engagement ? { id: engagement.id, name: engagement.name } : null,
    project: project ? { id: project.id, name: project.name } : null,
  }
}

function openBriefTasks(ownerPersonId: string | null) {
  let query = supabaseService
    .from('engagement_tasks')
    .select(BRIEF_TASK_SELECT, { count: 'exact' })
    .is('completed_at', null)
    .neq('status', 'done')
  query = ownerPersonId
    ? query.or(`assignee_person_id.eq.${ownerPersonId},assignee_person_id.is.null`)
    : query.is('assignee_person_id', null)
  return query
}

/**
 * Per active engagement: hours used vs included with days left in the month,
 * tier-1 milestones moved this week, invoices outstanding + due dates, and a
 * renewal flag when the term end is within 45 days — the bit that stops a notice
 * deadline slipping past.
 */
async function activeEngagementBriefs() {
  const engagements = await listEngagements({ excludeTerminal: true }, svc).catch(() => [])
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const today = todayDate()

  return Promise.all(
    engagements.map(async (e) => {
      const [hours, { data: milestones }, { data: billing }] = await Promise.all([
        engagementHoursThisMonth(e, svc),
        supabaseService
          .from('tier1_milestones')
          .select('completed_at, is_complete, account:accounts(name)')
          .eq('engagement_id', e.id)
          .gte('completed_at', weekAgo),
        supabaseService.from('engagement_billing_summary').select('*').eq('engagement_id', e.id).maybeSingle(),
      ])

      const b = billing as { total_outstanding?: number | string; next_due_date?: string | null; overdue_count?: number } | null

      // Flag on the NOTICE date (end_date - notice_period_days, computed in Postgres),
      // falling back to end_date when no notice period is set. Both are date-only, so
      // compare at UTC midnight to avoid timezone drift. Escalate as the date nears;
      // an auto-renewing engagement past its notice date reports "renewed", never
      // silently disappears.
      const basis: 'notice_date' | 'end_date' = e.notice_date ? 'notice_date' : 'end_date'
      const effective = e.notice_date ?? e.end_date
      let renewal: {
        notice_date: string | null; days_until_notice: number; end_date: string | null
        auto_renews: boolean; renewal_term_months: number | null; basis: string; level: string
      } | null = null
      if (effective) {
        const daysUntilNotice = Math.round((Date.parse(`${effective}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
        let level: string | null = null
        if (daysUntilNotice < 0) level = e.auto_renews ? 'renewed' : 'overdue'
        else if (daysUntilNotice <= 14) level = 'urgent'
        else if (daysUntilNotice <= RENEWAL_WINDOW_DAYS) level = 'informational'
        if (level) {
          renewal = {
            notice_date: e.notice_date ?? null,
            days_until_notice: daysUntilNotice,
            end_date: e.end_date,
            auto_renews: Boolean(e.auto_renews),
            renewal_term_months: e.renewal_term_months ?? null,
            basis,
            level,
          }
        }
      }

      return {
        id: e.id,
        code: e.code,
        name: e.name,
        end_client: e.end_client?.name ?? null,
        hours: {
          used: Math.round(hours.used * 100) / 100,
          included: hours.included,
          over: Math.round(hours.over * 100) / 100,
          // Billing month, anchored on the engagement's billing_month_start_day.
          period_start: hours.period.start,
          period_end: hours.period.end,
          days_left_in_month: daysLeftInPeriod(hours.period),
        },
        milestones_moved_this_week: ((milestones ?? []) as Array<{ completed_at: string | null; is_complete: boolean; account: { name: string } | { name: string }[] | null }>).map((m) => ({
          account: Array.isArray(m.account) ? m.account[0]?.name ?? null : m.account?.name ?? null,
          completed_at: m.completed_at,
        })),
        invoices_outstanding: {
          total: Number(b?.total_outstanding ?? 0),
          next_due_date: b?.next_due_date ?? null,
          overdue_count: Number(b?.overdue_count ?? 0),
        },
        renewal,
      }
    })
  ).then((rows) => ({ rows, today }))
}

type InvoiceSummaryRow = {
  line_items: LineItem[] | null
  vat_rate: number | null
}

function sumInvoiceTotals(rows: InvoiceSummaryRow[]) {
  return rows.reduce((sum, row) => {
    const totals = calculateTotals(row.line_items ?? [], Number(row.vat_rate ?? 0))
    return sum + totals.total
  }, 0)
}

/**
 * Today's brief: tasks (due today / overdue / due this week), calendar events
 * (today / this week), new enquiries, and invoice totals. Shared by the Cowork
 * REST `/api/cowork/briefing` route and the MCP `briefing` tool.
 */
export async function getCoworkBriefing() {
  const today = todayDate()
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(today, 7)
  const { data: ownerPersonId } = await supabaseService.rpc('owner_person_id')

  const [
    dueTodayResult,
    overdueResult,
    dueThisWeekResult,
    calendarTodayResult,
    calendarThisWeekResult,
    newCountResult,
    latestEnquiriesResult,
    overdueInvoicesResult,
    sentInvoicesResult,
  ] = await Promise.all([
    openBriefTasks(ownerPersonId)
      .eq('due_date', today)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    openBriefTasks(ownerPersonId)
      .lt('due_date', today)
      .order('due_date', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(OVERDUE_LIMIT),
    openBriefTasks(ownerPersonId)
      .gte('due_date', tomorrow)
      .lte('due_date', weekEnd)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseService
      .from('calendar_events')
      .select('id, title, start_at, end_at, all_day, location, description')
      .gte('start_at', startOfDayIso(today))
      .lt('start_at', startOfDayIso(tomorrow))
      .order('start_at', { ascending: true }),
    supabaseService
      .from('calendar_events')
      .select('id, title, start_at, end_at, all_day, location, description')
      .gte('start_at', startOfDayIso(tomorrow))
      .lt('start_at', `${weekEnd}T23:59:59.999Z`)
      .order('start_at', { ascending: true }),
    supabaseService
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabaseService
      .from('enquiries')
      .select('id, biz_name, contact_name, created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(3),
    supabaseService.from('invoices').select('line_items, vat_rate').eq('status', 'overdue'),
    supabaseService.from('invoices').select('line_items, vat_rate').eq('status', 'sent'),
  ])

  const firstError = [
    dueTodayResult.error,
    overdueResult.error,
    dueThisWeekResult.error,
    calendarTodayResult.error,
    calendarThisWeekResult.error,
    newCountResult.error,
    latestEnquiriesResult.error,
    overdueInvoicesResult.error,
    sentInvoicesResult.error,
  ].find(Boolean)

  if (firstError) {
    throw firstError
  }

  const engagements = await activeEngagementBriefs().then((r) => r.rows).catch(() => [])

  return {
    date: today,
    engagements,
    tasks: {
      due_today: ((dueTodayResult.data ?? []) as unknown as BriefTaskRow[]).map(formatBriefTask),
      // Most recently overdue first, capped at OVERDUE_LIMIT; overdue_count is the full figure.
      overdue: ((overdueResult.data ?? []) as unknown as BriefTaskRow[]).map(formatBriefTask),
      overdue_count: overdueResult.count ?? 0,
      due_this_week: ((dueThisWeekResult.data ?? []) as unknown as BriefTaskRow[]).map(formatBriefTask),
    },
    calendar: {
      today: calendarTodayResult.data ?? [],
      this_week: calendarThisWeekResult.data ?? [],
    },
    enquiries: {
      new_count: newCountResult.count ?? 0,
      latest: latestEnquiriesResult.data ?? [],
    },
    invoices: {
      overdue_count: overdueInvoicesResult.data?.length ?? 0,
      overdue_total: sumInvoiceTotals((overdueInvoicesResult.data ?? []) as InvoiceSummaryRow[]),
      sent_count: sentInvoicesResult.data?.length ?? 0,
      sent_total: sumInvoiceTotals((sentInvoicesResult.data ?? []) as InvoiceSummaryRow[]),
    },
  }
}
