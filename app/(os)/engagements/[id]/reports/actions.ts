'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { buildEngagementPeriodReport } from '@/lib/reports/period-spine'
import { generateNarrative, NarrativeSchema, EMPTY_NARRATIVE } from '@/lib/reports/narrative'
import { generateEngagementReport, rerenderReportPdf, type ReportKind } from '@/lib/reports/generate'
import { sendReport } from '@/lib/reports/send'

const VALID_KINDS: ReportKind[] = ['weekly_client', 'monthly_client', 'weekly_internal']

/** Generate a draft report and route to its review screen. An explicit period
 *  overrides the kind's default (this week / last month) — pass both dates. */
export async function generateReportAction(
  engagementId: string,
  kind: ReportKind,
  period?: { start?: string; end?: string }
): Promise<{ error?: string }> {
  if (!VALID_KINDS.includes(kind)) return { error: 'Unknown report kind' }
  const periodStart = period?.start?.trim() || undefined
  const periodEnd = period?.end?.trim() || undefined
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    return { error: 'Enter both a start and end date, or leave both blank for the default period.' }
  }
  if (periodStart && periodEnd && periodStart > periodEnd) {
    return { error: 'The start date must be on or before the end date.' }
  }
  let reportId: string
  try {
    reportId = await generateEngagementReport({ engagementId, kind, periodStart, periodEnd })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to generate report' }
  }
  revalidatePath(`/engagements/${engagementId}/reports`)
  redirect(`/engagements/${engagementId}/reports/${reportId}`)
}

async function loadReport(reportId: string) {
  const supabase = await createClient()
  await requireAdmin(supabase)
  const { data, error } = await supabase
    .from('engagement_reports')
    .select('id, engagement_id, kind, period_start, period_end, status, narrative_json, narrative_edited')
    .eq('id', reportId)
    .maybeSingle()
  if (error || !data) throw new Error('Report not found')
  if (data.status === 'sent') throw new Error('This report has been sent and can no longer be edited.')
  return { supabase, report: data }
}

/** Save user-edited narrative prose; re-render the PDF from it. */
export async function saveNarrativeAction(reportId: string, narrative: unknown): Promise<{ error?: string }> {
  const parsed = NarrativeSchema.safeParse(narrative)
  if (!parsed.success) return { error: 'The edited report is missing required sections.' }
  try {
    const { supabase, report } = await loadReport(reportId)
    await supabase.from('engagement_reports').update({ narrative_edited: parsed.data, narrative_error: null }).eq('id', reportId)
    await rerenderReportPdf(reportId, supabase)
    revalidatePath(`/engagements/${report.engagement_id}/reports/${reportId}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save' }
  }
}

/**
 * Re-run the narrative from the spine. On a C3 rejection (or LLM miss) we DON'T
 * silently fall back: the reason is written to narrative_error and shown as the
 * review banner, the PDF re-renders with the factual spine and no prose.
 */
export async function regenerateFullAction(reportId: string): Promise<{ error?: string }> {
  try {
    const { supabase, report } = await loadReport(reportId)
    const spine = await buildEngagementPeriodReport(
      report.engagement_id as string, report.period_start as string, report.period_end as string, {}, supabase
    )
    try {
      const fresh = await generateNarrative(spine)
      await supabase.from('engagement_reports').update({ narrative_edited: fresh, narrative_error: null, spine_json: spine }).eq('id', reportId)
      await rerenderReportPdf(reportId, supabase)
      revalidatePath(`/engagements/${report.engagement_id}/reports/${reportId}`)
      return {}
    } catch (genErr) {
      const reason = genErr instanceof Error ? genErr.message : 'Narrative generation failed'
      await supabase.from('engagement_reports').update({ narrative_edited: EMPTY_NARRATIVE, narrative_error: reason, spine_json: spine }).eq('id', reportId)
      await rerenderReportPdf(reportId, supabase)
      revalidatePath(`/engagements/${report.engagement_id}/reports/${reportId}`)
      return { error: reason }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to regenerate' }
  }
}

/** Send the report to its recipients (PDF + XLSX attached). Requires a human click. */
export async function sendReportAction(reportId: string): Promise<{ error?: string; sent?: boolean }> {
  try {
    const { report } = await loadReport(reportId) // also blocks if already sent
    await sendReport(reportId)
    revalidatePath(`/engagements/${report.engagement_id}/reports/${reportId}`)
    revalidatePath(`/engagements/${report.engagement_id}/reports`)
    return { sent: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to send' }
  }
}

/** Update the explicit recipient list (the user must add these before send). */
export async function setRecipientsAction(reportId: string, emails: string[]): Promise<{ error?: string }> {
  const clean = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))))
  try {
    const { supabase, report } = await loadReport(reportId)
    await supabase.from('engagement_reports').update({ recipient_emails: clean }).eq('id', reportId)
    revalidatePath(`/engagements/${report.engagement_id}/reports/${reportId}`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update recipients' }
  }
}
