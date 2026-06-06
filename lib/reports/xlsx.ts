import ExcelJS from 'exceljs'
import type { ReportData } from './data'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F766E' },
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = HEADER_FILL
  })
}

function dayName(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })
}

/** Build the 4-sheet timesheet workbook from the same ReportData the PDF uses. */
export async function buildReportXlsx(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Trailhead Holdings Ltd'
  wb.created = new Date(`${data.period.end}T00:00:00`)

  const currency = data.engagement.currency
  const moneyFmt = `${currency === 'GBP' ? '£' : ''}#,##0.00`
  const showValue = data.engagement.is_billable

  // Value per person / project, computed from the same entries.
  const valueByPerson = new Map<string, number>()
  const valueByProject = new Map<string, number>()
  for (const e of data.time_entries) {
    const pName = e.person_full_name ?? 'Unattributed'
    valueByPerson.set(pName, (valueByPerson.get(pName) ?? 0) + e.value)
    const prj = e.project?.name ?? 'No project'
    valueByProject.set(prj, (valueByProject.get(prj) ?? 0) + e.value)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const s = wb.addWorksheet('Summary')
  s.columns = [{ width: 26 }, { width: 26 }]
  s.addRow(['Engagement', data.engagement.name])
  if (data.engagement.code) s.addRow(['Code', data.engagement.code])
  s.addRow(['Client', data.engagement.end_client ?? '—'])
  if (data.engagement.billed_via) s.addRow(['Billed via', data.engagement.billed_via])
  s.addRow(['Period', `${data.period.start} to ${data.period.end}`])
  s.addRow([])
  const sHead = s.addRow(['Metric', 'Value'])
  styleHeader(sHead)
  s.addRow(['Total hours', data.hours_summary.total])
  s.addRow(['Billable hours', data.hours_summary.billable])
  s.addRow(['Non-billable hours', data.hours_summary.non_billable])
  if (showValue) {
    const v = s.addRow(['Billable value', data.totals.value_gbp])
    v.getCell(2).numFmt = moneyFmt
  }
  if (data.engagement.included_hours != null) {
    s.addRow(['Retainer hours', data.engagement.included_hours])
    s.addRow(['Retainer used %', `${data.totals.vs_retainer_pct ?? 0}%`])
  }

  // ── Detail ───────────────────────────────────────────────────────────────
  const d = wb.addWorksheet('Detail')
  d.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Day', key: 'day', width: 7 },
    { header: 'Person', key: 'person', width: 20 },
    { header: 'Project', key: 'project', width: 22 },
    { header: 'Task', key: 'task', width: 28 },
    { header: 'Hours', key: 'hours', width: 8 },
    { header: 'Billable', key: 'billable', width: 9 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'Rate', key: 'rate', width: 10 },
    { header: 'Value', key: 'value', width: 12 },
  ]
  styleHeader(d.getRow(1))
  const sorted = [...data.time_entries].sort((a, b) => a.work_date.localeCompare(b.work_date))
  for (const e of sorted) {
    const row = d.addRow({
      date: e.work_date,
      day: dayName(e.work_date),
      person: e.person_full_name ?? '—',
      project: e.project?.name ?? '—',
      task: e.engagement_task?.title ?? '—',
      hours: e.hours,
      billable: e.billable ? 'Yes' : 'No',
      notes: e.notes ?? '',
      rate: e.rate,
      value: showValue ? e.value : null,
    })
    row.getCell('rate').numFmt = moneyFmt
    row.getCell('value').numFmt = moneyFmt
  }
  const dTotal = d.addRow({ task: 'Total', hours: data.hours_summary.total, value: showValue ? data.totals.value_gbp : null })
  dTotal.font = { bold: true }
  dTotal.getCell('value').numFmt = moneyFmt
  d.views = [{ state: 'frozen', ySplit: 1 }]

  // ── By Person ────────────────────────────────────────────────────────────
  const bp = wb.addWorksheet('By Person')
  bp.columns = [
    { header: 'Person', key: 'person', width: 26 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Value', key: 'value', width: 14 },
  ]
  styleHeader(bp.getRow(1))
  for (const p of data.hours_summary.by_person) {
    const r = bp.addRow({ person: p.name, hours: p.hours, value: showValue ? Math.round((valueByPerson.get(p.name) ?? 0) * 100) / 100 : null })
    r.getCell('value').numFmt = moneyFmt
  }
  const bpTotal = bp.addRow({ person: 'Total', hours: data.hours_summary.total, value: showValue ? data.totals.value_gbp : null })
  bpTotal.font = { bold: true }
  bpTotal.getCell('value').numFmt = moneyFmt
  bp.views = [{ state: 'frozen', ySplit: 1 }]

  // ── By Project ───────────────────────────────────────────────────────────
  const bj = wb.addWorksheet('By Project')
  bj.columns = [
    { header: 'Project', key: 'project', width: 30 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Value', key: 'value', width: 14 },
  ]
  styleHeader(bj.getRow(1))
  for (const p of data.hours_summary.by_project) {
    const r = bj.addRow({ project: p.name, hours: p.hours, value: showValue ? Math.round((valueByProject.get(p.name) ?? 0) * 100) / 100 : null })
    r.getCell('value').numFmt = moneyFmt
  }
  const bjTotal = bj.addRow({ project: 'Total', hours: data.hours_summary.total, value: showValue ? data.totals.value_gbp : null })
  bjTotal.font = { bold: true }
  bjTotal.getCell('value').numFmt = moneyFmt
  bj.views = [{ state: 'frozen', ySplit: 1 }]

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** `{code|name}_{start}_{end}_timesheet.xlsx` */
export function reportXlsxFilename(data: ReportData): string {
  const slug = (data.engagement.code ?? data.engagement.name).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
  return `${slug}_${data.period.start}_${data.period.end}_timesheet.xlsx`
}
