/**
 * One-off: parse every existing seo_serp_snapshots row into seo_serp_state
 * (A3). Safe to re-run — upserts on snapshot_id.
 *
 * Run from the repo root:  npx tsx scripts/backfill-serp-state.ts
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseSnapshot } from '../lib/growth/serp-parse'

const env: Record<string, string> = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, key)

async function main() {
  const { data: sites } = await supabase.from('seo_sites').select('id, domain')
  const domainBySite = new Map((sites ?? []).map((s) => [s.id as string, s.domain as string]))
  const { data: keywords } = await supabase.from('seo_keywords').select('id, site_id')
  const siteByKeyword = new Map((keywords ?? []).map((k) => [k.id as string, k.site_id as string]))

  let parsed = 0
  let skipped = 0
  for (let offset = 0; ; offset += 200) {
    const { data: snapshots, error } = await supabase
      .from('seo_serp_snapshots')
      .select('id, keyword_id, captured_at, results')
      .order('captured_at', { ascending: true })
      .range(offset, offset + 199)
    if (error) throw new Error(error.message)
    if (!snapshots || snapshots.length === 0) break
    for (const snap of snapshots) {
      const domain = domainBySite.get(siteByKeyword.get(snap.keyword_id as string) ?? '')
      if (!domain) {
        skipped += 1
        continue
      }
      const state = parseSnapshot(domain, snap.results as { items?: Array<Record<string, unknown>> })
      const { error: upErr } = await supabase
        .from('seo_serp_state')
        .upsert({ keyword_id: snap.keyword_id, snapshot_id: snap.id, captured_at: snap.captured_at, ...state }, { onConflict: 'snapshot_id' })
      if (upErr) {
        console.error(`snapshot ${snap.id}: ${upErr.message}`)
        skipped += 1
      } else parsed += 1
    }
    if (snapshots.length < 200) break
  }
  console.log(`Parsed ${parsed} snapshots, skipped ${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
