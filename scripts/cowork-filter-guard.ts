/**
 * Regression guard for the Cowork API filter bug: a supplied filter that doesn't
 * resolve must NEVER fall through to an unfiltered "all rows" response.
 *
 * Runs against a live server (it exercises the real routes + DB), so point it at
 * a running dev server or prod:
 *
 *   COWORK_BASE=http://localhost:3939 COWORK_API_KEY=... \
 *     npx tsx scripts/cowork-filter-guard.ts
 *
 * Exits non-zero on any regression.
 */
const BASE = process.env.COWORK_BASE || 'http://localhost:3939'
const KEY = process.env.COWORK_API_KEY
const GARBAGE = '00000000-0000-0000-0000-000000000000'

if (!KEY) {
  console.error('Set COWORK_API_KEY (and optionally COWORK_BASE).')
  process.exit(2)
}
const H = { Authorization: `Bearer ${KEY}` }

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}

async function get(path: string): Promise<{ status: number; rows: number }> {
  const res = await fetch(`${BASE}${path}`, { headers: H })
  let rows = 0
  const body = await res.json().catch(() => null)
  if (Array.isArray(body)) rows = body.length
  else if (body && Array.isArray(body.entries)) rows = body.entries.length
  return { status: res.status, rows }
}

async function main() {
  // /time — the money-critical one (engagement hours feed invoicing).
  console.log('/api/cowork/time')
  const timeAll = await get('/api/cowork/time?limit=500')
  const timeGarbage = await get(`/api/cowork/time?engagement_id=${GARBAGE}&limit=500`)
  ok('unfiltered returns rows', timeAll.rows > 0, `${timeAll.rows} rows`)
  ok('garbage engagement_id does NOT return the full set', timeGarbage.rows === 0 || timeGarbage.status === 404, `status ${timeGarbage.status}, ${timeGarbage.rows} rows`)

  // /invoices
  console.log('/api/cowork/invoices')
  const invAll = await get('/api/cowork/invoices?limit=100')
  const invGarbage = await get(`/api/cowork/invoices?engagement_id=${GARBAGE}&limit=100`)
  ok('unfiltered returns rows', invAll.rows > 0, `${invAll.rows} rows`)
  ok('garbage engagement_id does NOT return the full set', invGarbage.rows === 0 || invGarbage.status === 404, `status ${invGarbage.status}, ${invGarbage.rows} rows`)

  // /tasks — kanban, not engagement-scoped: must reject the param, not fake a filter.
  console.log('/api/cowork/tasks')
  const tasksGarbage = await get(`/api/cowork/tasks?engagement_id=${GARBAGE}`)
  ok('engagement_id is rejected (400), not silently ignored', tasksGarbage.status === 400, `status ${tasksGarbage.status}`)

  console.log(`\n${fail === 0 ? '✓ COWORK FILTER GUARD PASSED' : `✗ ${fail} REGRESSION(S)`}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
