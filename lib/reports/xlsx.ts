import ExcelJS from 'exceljs'
import type { ReportData } from './data'
import { toClientSafeTimeEntry, type ClientSafeTimeEntry } from '@/lib/engagements/client-safe'

// Near-black header band (no colour tied to money). ARGB.
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0C0C14' },
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
  })
}

/**
 * Client-facing timesheet workbook. Stage A: this is a CLIENT artefact, so it
 * carries hours only — never rates, values, billable flags, internal notes or
 * contributor identities. Two sheets: an hours Summary and a Date/Description/
 * Hours detail. Every row goes through the client-safe projection.
 */
export async function buildReportXlsx(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Trailhead Holdings Ltd'

  const entries: ClientSafeTimeEntry[] = data.time_entries
    .map((e) =>
      toClientSafeTimeEntry({
        entry_date: e.work_date,
        hours: e.hours,
        description: e.notes,
        client_description: e.client_description,
      })
    )
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100
  const included = data.engagement.included_hours
  const over = included != null ? Math.max(0, Math.round((totalHours - included) * 100) / 100) : null

  // ── Summary (hours only — no money) ────────────────────────────────────────
  const s = wb.addWorksheet('Summary')
  s.columns = [{ width: 30 }, { width: 22 }]
  s.addRow(['Engagement', data.engagement.name])
  if (data.engagement.code) s.addRow(['Code', data.engagement.code])
  s.addRow(['Client', data.engagement.end_client ?? '—'])
  s.addRow(['Period', `${data.period.start} to ${data.period.end}`])
  s.addRow([])
  const sHead = s.addRow(['Metric', 'Hours'])
  styleHeader(sHead)
  s.addRow(['Total hours in period', totalHours])
  if (included != null) {
    s.addRow(['Hours included (monthly allowance)', included])
    s.addRow(['Hours over allowance', over ?? 0])
  }

  // ── Detail (Date, Description, Hours — nothing else) ────────────────────────
  const d = wb.addWorksheet('Detail')
  d.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'description', width: 70 },
    { header: 'Hours', key: 'hours', width: 10 },
  ]
  styleHeader(d.getRow(1))
  for (const e of entries) {
    d.addRow({ date: e.entry_date, description: e.description, hours: e.hours })
  }
  const dTotal = d.addRow({ description: 'Total', hours: totalHours })
  dTotal.font = { bold: true }
  d.views = [{ state: 'frozen', ySplit: 1 }]

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** `{code|name}_{start}_{end}_timesheet.xlsx` */
export function reportXlsxFilename(data: ReportData): string {
  const slug = (data.engagement.code ?? data.engagement.name).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
  return `${slug}_${data.period.start}_${data.period.end}_timesheet.xlsx`
}
