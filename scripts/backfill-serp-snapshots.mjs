#!/usr/bin/env node
/**
 * One-off recovery: pull completed DataForSEO SERP tasks by ID and insert the
 * snapshots the growth-collect cron lost.
 *
 * Why this exists: tasks_ready is a once-only list. Collect runs failed during
 * the API-password reset window, so these completed tasks fell off it. task_get
 * still serves them by ID for 30 days.
 *
 * Run from the repo root:  node scripts/backfill-serp-snapshots.mjs
 * Reads DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD / NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY from .env.local. Safe to re-run: it skips any
 * keyword that already has a snapshot.
 */
import { readFileSync } from 'node:fs'

// Latest completed task per keyword, from the DataForSEO export.
const TASKS = [
  { id: '08181719-2322-0066-0000-e877059b05e6', keyword: 'engineer scheduling software' },
  { id: '08181232-2322-0066-0000-c3737e7e5843', keyword: 'engineeros' },
  { id: '08181232-2322-0066-0000-2323a004961d', keyword: 'billing software for engineers' },
  { id: '08181232-2322-0066-0000-b7ff8f43e51a', keyword: 'engineeroffice pricing' },
  { id: '08181232-2322-0066-0000-b4e65967fe2c', keyword: 'engineering forms' },
  { id: '08181231-2322-0066-0000-0c958b9d19db', keyword: 'engineer tracker' },
  { id: '08181231-2322-0066-0000-36406611e166', keyword: 'job management for engineers' },
]

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const { DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env
for (const [k, v] of Object.entries({ DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1) }
}

const dfsAuth = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
const sb = (path, init = {}) =>
  fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

let stored = 0, skipped = 0, failed = 0

for (const task of TASKS) {
  try {
    const res = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/regular/${task.id}`, {
      headers: { Authorization: dfsAuth },
    })
    const json = await res.json()
    const t = json.tasks?.[0]
    if (!t) throw new Error(`no task in response (status ${json.status_code} ${json.status_message})`)
    if (t.status_code !== 20000) throw new Error(`task status ${t.status_code}: ${t.status_message}`)

    const tag = t.tag ?? t.data?.tag // task_get echoes the tag inside data
    const keywordId = tag?.startsWith('serp:') ? tag.slice('serp:'.length) : null
    if (!keywordId) throw new Error(`unusable tag: ${tag}`)
    const payload = t.result?.[0]
    if (!payload) throw new Error('task returned no result rows')

    const existing = await sb(`seo_serp_snapshots?keyword_id=eq.${keywordId}&select=id&limit=1`)
    if ((await existing.json()).length > 0) {
      console.log(`· skip   ${task.keyword} — snapshot already present`)
      skipped++
      continue
    }

    const ins = await sb('seo_serp_snapshots', {
      method: 'POST',
      body: JSON.stringify({ keyword_id: keywordId, results: payload }),
    })
    if (!ins.ok) throw new Error(`insert failed: ${ins.status} ${await ins.text()}`)

    const items = payload.items?.length ?? 0
    console.log(`✓ stored ${task.keyword} — ${items} SERP items`)
    stored++
  } catch (err) {
    console.error(`✗ FAILED ${task.keyword}: ${err.message}`)
    failed++
  }
}

console.log(`\n${stored} stored, ${skipped} already present, ${failed} failed.`)
if (stored > 0) console.log('Go back to /growth and hit "Generate brief" — the snapshots are there now.')
