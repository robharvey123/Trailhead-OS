import { NextRequest, NextResponse } from 'next/server'
import {
  addDays,
  endOfDayIso,
  jsonError,
  mapTask,
  requireCoworkAuth,
  startOfDayIso,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'
import { calculateTotals, type LineItem } from '@/lib/types'

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

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  const today = todayDate()
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(today, 7)

  try {
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
      supabaseService
        .from('tasks')
        .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
        .eq('due_date', today)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true }),
      supabaseService
        .from('tasks')
        .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
        .lt('due_date', today)
        .is('completed_at', null)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabaseService
        .from('tasks')
        .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
        .gte('due_date', tomorrow)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabaseService
        .from('calendar_events')
        .select('id, title, start_at, end_at, all_day, location, description')
        .gte('start_at', startOfDayIso(today))
        .lte('start_at', endOfDayIso(today))
        .order('start_at', { ascending: true }),
      supabaseService
        .from('calendar_events')
        .select('id, title, start_at, end_at, all_day, location, description')
        .gte('start_at', startOfDayIso(tomorrow))
        .lte('start_at', endOfDayIso(weekEnd))
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
      supabaseService
        .from('invoices')
        .select('line_items, vat_rate')
        .eq('status', 'overdue'),
      supabaseService
        .from('invoices')
        .select('line_items, vat_rate')
        .eq('status', 'sent'),
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

    return NextResponse.json({
      date: today,
      tasks: {
        due_today: (dueTodayResult.data ?? []).map((row) => mapTask(row)),
        overdue: (overdueResult.data ?? []).map((row) => mapTask(row)),
        due_this_week: (dueThisWeekResult.data ?? []).map((row) => mapTask(row)),
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
    })
  } catch (error) {
    return jsonError(error, 'Failed to load briefing')
  }
}
