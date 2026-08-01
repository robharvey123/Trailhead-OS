/**
 * Client-leakage regression guard (Stage A4).
 *
 * Builds every client-facing artefact from a *deliberately leaky* synthetic
 * ReportData (rates, values, internal notes, contributor names, is_billable) and
 * asserts the serialised output contains none of the excluded field names and no
 * currency symbol. Runs with NO database and NO network, so it is safe in
 * `prebuild` on Vercel. Exits non-zero on any leak, which fails the build.
 *
 * Run: `npm run test:reports-leakage` (also runs automatically before `build`).
 */
import ExcelJS from 'exceljs'
import { buildReportXlsx } from '../lib/reports/xlsx'
import {
  toClientSafeTimeEntry,
  toClientSafeTask,
  EXCLUDED_FIELD_NAMES,
  CURRENCY_SYMBOLS,
} from '../lib/engagements/client-safe'
import type { ReportData } from '../lib/reports/data'

// A synthetic period stuffed with everything a client must never see.
const LEAKY: ReportData = {
  engagement: {
    id: 'eng-1',
    name: 'Qola — UK/EU Commercial (Annex A)',
    code: 'QOLA-UKEU-26',
    end_client: 'Qola Ltd',
    billed_via: 'Trailhead Holdings Ltd',
    currency: 'GBP',
    day_rate: 500,
    retainer: 2000,
    included_hours: 40,
    is_billable: true,
  },
  period: { start: '2026-08-01', end: '2026-08-07', working_days: 5 },
  time_entries: [
    {
      work_date: '2026-08-03',
      hours: 3,
      notes: 'INTERNAL: chase supplier, margin looks thin at this rate',
      client_description: null,
      billable: true,
      rate: 150,
      value: 450,
      person_full_name: 'Rob Harvey',
      engagement_task: { id: 't1', title: 'Distributor outreach', client_description: null },
      project: { id: 'p1', name: 'Listings' },
    },
    {
      work_date: '2026-08-05',
      hours: 2.5,
      notes: 'call re pricing',
      client_description: 'Reviewed distributor shortlist',
      billable: false,
      rate: 0,
      value: 0,
      person_full_name: 'Rob Harvey',
      engagement_task: null,
      project: null,
    },
  ],
  tasks_completed: [
    {
      id: 't1',
      title: 'Distributor outreach',
      description: 'INTERNAL note: push hard, they are desperate',
      client_description: null,
      completed_at: '2026-08-03T10:00:00',
      assignee_full_name: 'Rob Harvey',
      project_name: 'Listings',
    },
  ],
  hours_summary: {
    total: 5.5,
    billable: 3,
    non_billable: 2.5,
    by_person: [{ name: 'Rob Harvey', hours: 5.5 }],
    by_project: [{ name: 'Listings', hours: 3 }],
    by_day: [{ date: '2026-08-03', hours: 3 }],
  },
  totals: { hours: 5.5, value_gbp: 450, vs_retainer_hours: 40, vs_retainer_pct: 14 },
}

const violations: string[] = []

function scan(artefact: string, text: string) {
  const hay = text.toLowerCase()
  for (const name of EXCLUDED_FIELD_NAMES) {
    if (hay.includes(name.toLowerCase())) violations.push(`${artefact}: excluded field name "${name}" present`)
  }
  for (const sym of CURRENCY_SYMBOLS) {
    if (text.includes(sym)) violations.push(`${artefact}: currency symbol "${sym}" present`)
  }
  // Belt and braces: the internal execution notes must never appear.
  if (hay.includes('internal')) violations.push(`${artefact}: the word "internal" (execution note) present`)
}

async function main() {
  // 1. The projection layer output — this is what "re-adding rate_snapshot to the
  //    projection" would leak into.
  const projectedEntries = LEAKY.time_entries.map((e) =>
    toClientSafeTimeEntry({
      entry_date: e.work_date,
      hours: e.hours,
      entry_client_description: e.client_description,
      entry_description: e.notes,
      task_client_description: e.engagement_task?.client_description ?? null,
      task_title: e.engagement_task?.title ?? null,
    })
  )
  const projectedTasks = LEAKY.tasks_completed.map(toClientSafeTask)
  scan('projection:time_entries', JSON.stringify(projectedEntries))
  scan('projection:tasks', JSON.stringify(projectedTasks))

  // 2. The XLSX timesheet — load the built workbook back and read every sheet
  //    name, header, cell value and number format.
  const buf = await buildReportXlsx(LEAKY)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const chunks: string[] = []
  wb.eachSheet((sheet) => {
    chunks.push(sheet.name)
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value != null) chunks.push(String(cell.value))
        if (cell.numFmt) chunks.push(cell.numFmt)
      })
    })
  })
  scan('xlsx', chunks.join('\n'))

  if (violations.length) {
    console.error('\n✖ CLIENT-LEAKAGE GUARD FAILED — a client artefact exposes internal data:\n')
    for (const v of violations) console.error('  - ' + v)
    console.error('\nA client-facing report must carry hours only: no rates, values, billable flags,')
    console.error('internal notes or contributor rates. Fix the projection/renderer before shipping.\n')
    process.exit(1)
  }
  console.log('✓ client-leakage guard passed — XLSX + projections carry no excluded fields or currency.')
}

main().catch((e) => {
  console.error('client-leakage guard errored:', e)
  process.exit(1)
})
