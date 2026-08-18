import { createClient } from '@/lib/supabase/service'
import {
  type KeywordIdeaItem,
  type SerpTaskResult,
  fetchKeywordIdeasTask,
  fetchSerpTask,
  getKeywordIdeasTasksReady,
  getSerpTasksReady,
  postKeywordIdeasTask,
  postSerpTasks,
} from '@/lib/growth/dataforseo'

/**
 * DataForSEO orchestration (Growth module). Tasks are posted with a routing tag
 * (`kw:<site_id>` / `serp:<keyword_id>`) AND recorded in `seo_dfs_tasks`, which
 * is the pending queue. Collection walks that ledger and fetches each task by
 * id, so a failed tick (bad credentials, a deploy blip, a DataForSEO 5xx) costs
 * a retry rather than the work — DataForSEO's own tasks_ready is a once-only
 * list and cannot be relied on for that. It is still swept each tick to adopt
 * anything the ledger has never seen.
 */

const KW_TAG = 'kw:'
const SERP_TAG = 'serp:'

/** Stop retrying after ~5 hours at the 15-minute cron cadence. */
const MAX_ATTEMPTS = 20
/** Tasks fetched per tick — bounds the cron's runtime, remainder waits. */
const BATCH = 40

type Supabase = ReturnType<typeof createClient>

async function recordTasks(
  supabase: Supabase,
  rows: Array<{ id: string; kind: 'serp' | 'keyword_ideas'; tag: string; keyword?: string }>
) {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('seo_dfs_tasks')
    .upsert(rows.map((r) => ({ ...r, keyword: r.keyword ?? null })), { onConflict: 'id' })
  // A ledger write failure must not lose the posted task: surface it loudly.
  if (error) throw new Error(`Posted DataForSEO task but failed to record it: ${error.message}`)
}

/** Queue keyword research for a site. Results land on the next collect tick. */
export async function requestKeywordIdeas(siteId: string, seeds: string[]): Promise<string> {
  const cleaned = seeds.map((s) => s.trim()).filter(Boolean)
  if (cleaned.length === 0) throw new Error('At least one seed keyword is required')
  const tag = `${KW_TAG}${siteId}`
  const id = await postKeywordIdeasTask(cleaned, tag)
  await recordTasks(createClient(), [{ id, kind: 'keyword_ideas', tag, keyword: cleaned.join(', ') }])
  return id
}

/** Queue SERP snapshots for keywords (id → keyword text). */
export async function requestSerpSnapshots(keywords: Array<{ id: string; keyword: string }>) {
  const posted = await postSerpTasks(
    keywords.map((k) => ({ keyword: k.keyword, tag: `${SERP_TAG}${k.id}` }))
  )
  const byTag = new Map(keywords.map((k) => [`${SERP_TAG}${k.id}`, k.keyword]))
  await recordTasks(
    createClient(),
    posted
      .filter((t): t is { id: string; tag: string } => Boolean(t.tag))
      .map((t) => ({ id: t.id, kind: 'serp' as const, tag: t.tag, keyword: byTag.get(t.tag) }))
  )
  return posted
}

export interface CollectResult {
  keywordTasks: number
  keywordsUpserted: number
  serpTasks: number
  snapshotsStored: number
  pending: number
  abandoned: number
  errors: string[]
}

interface PendingTask {
  id: string
  kind: 'serp' | 'keyword_ideas'
  tag: string
  attempts: number
}

/** Land a keyword-ideas payload: insert new keywords, refresh known ones. */
async function storeKeywordIdeas(
  supabase: Supabase,
  siteId: string,
  items: KeywordIdeaItem[],
  result: CollectResult
) {
  const now = new Date().toISOString()
  const { data: existing, error: existingError } = await supabase
    .from('seo_keywords')
    .select('keyword')
    .eq('site_id', siteId)
  if (existingError) throw new Error(existingError.message)
  const known = new Set((existing ?? []).map((k) => k.keyword as string))

  const normalised = items.map((item) => ({
    ...item,
    keyword: item.keyword?.trim().toLowerCase() ?? '',
  }))

  const seen = new Set<string>()
  const rows = normalised
    .filter((item) => {
      if (!item.keyword || known.has(item.keyword) || seen.has(item.keyword)) return false
      seen.add(item.keyword)
      return true
    })
    .map((item) => ({
      site_id: siteId,
      keyword: item.keyword,
      search_volume: item.search_volume,
      // Google Ads competition index (0-100) — a paid-competition proxy, the
      // closest thing to difficulty this endpoint returns.
      difficulty: item.competition_index,
      source: 'dataforseo',
      last_refreshed_at: now,
    }))
  if (rows.length > 0) {
    const { error } = await supabase.from('seo_keywords').insert(rows)
    if (error) throw new Error(error.message)
    result.keywordsUpserted += rows.length
  }

  // Refresh volume/difficulty on keywords we already track (e.g. from GSC).
  for (const item of normalised.filter((i) => i.keyword && known.has(i.keyword))) {
    const { error } = await supabase
      .from('seo_keywords')
      .update({
        search_volume: item.search_volume,
        difficulty: item.competition_index,
        last_refreshed_at: now,
      })
      .eq('site_id', siteId)
      .eq('keyword', item.keyword)
    if (error) throw new Error(error.message)
  }
}

async function storeSerpSnapshot(
  supabase: Supabase,
  keywordId: string,
  payload: SerpTaskResult,
  result: CollectResult
) {
  const { error } = await supabase
    .from('seo_serp_snapshots')
    .insert({ keyword_id: keywordId, results: payload })
  if (error) throw new Error(error.message)
  result.snapshotsStored += 1
}

/** Adopt anything DataForSEO reports ready that the ledger has never seen —
 *  tasks posted before the ledger existed, or from the DataForSEO dashboard. */
async function adoptReadyTasks(supabase: Supabase, result: CollectResult) {
  const ready = [
    ...(await getSerpTasksReady()).map((t) => ({ ...t, kind: 'serp' as const })),
    ...(await getKeywordIdeasTasksReady()).map((t) => ({ ...t, kind: 'keyword_ideas' as const })),
  ].filter((t) => t.tag?.startsWith(SERP_TAG) || t.tag?.startsWith(KW_TAG))
  if (ready.length === 0) return

  const { data: known, error } = await supabase
    .from('seo_dfs_tasks')
    .select('id')
    .in('id', ready.map((t) => t.id))
  if (error) {
    result.errors.push(`ledger lookup during adopt: ${error.message}`)
    return
  }
  const knownIds = new Set((known ?? []).map((r) => r.id as string))
  const fresh = ready.filter((t) => !knownIds.has(t.id))
  if (fresh.length === 0) return

  await recordTasks(
    supabase,
    fresh.map((t) => ({ id: t.id, kind: t.kind, tag: t.tag as string }))
  )
}

/** Cron entry point — work the ledger, landing everything DataForSEO has finished. */
export async function collectReadyResults(): Promise<CollectResult> {
  const supabase = createClient()
  const result: CollectResult = {
    keywordTasks: 0,
    keywordsUpserted: 0,
    serpTasks: 0,
    snapshotsStored: 0,
    pending: 0,
    abandoned: 0,
    errors: [],
  }

  try {
    await adoptReadyTasks(supabase, result)
  } catch (err) {
    result.errors.push(`adopt sweep: ${err instanceof Error ? err.message : String(err)}`)
  }

  const { data: pending, error: pendingError } = await supabase
    .from('seo_dfs_tasks')
    .select('id, kind, tag, attempts')
    .is('collected_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('posted_at', { ascending: true })
    .limit(BATCH)
  if (pendingError) {
    result.errors.push(`ledger read: ${pendingError.message}`)
    return result
  }

  for (const task of (pending ?? []) as PendingTask[]) {
    const attempts = task.attempts + 1
    try {
      const fetched =
        task.kind === 'serp' ? await fetchSerpTask(task.id) : await fetchKeywordIdeasTask(task.id)

      if (fetched.state === 'pending') {
        result.pending += 1
        await supabase.from('seo_dfs_tasks').update({ attempts }).eq('id', task.id)
        if (attempts >= MAX_ATTEMPTS) {
          result.abandoned += 1
          result.errors.push(`task ${task.id} still queued after ${MAX_ATTEMPTS} attempts`)
        }
        continue
      }

      if (fetched.state === 'failed') {
        // A task DataForSEO has rejected will never succeed — close it out.
        await supabase
          .from('seo_dfs_tasks')
          .update({ attempts, collected_at: new Date().toISOString(), last_error: fetched.reason })
          .eq('id', task.id)
        result.abandoned += 1
        result.errors.push(`task ${task.id}: ${fetched.reason}`)
        continue
      }

      // The ledger's tag is authoritative — task_get echoes it inside `data`,
      // which is exactly the field that silently went missing before.
      const tag = task.tag || fetched.tag || ''

      if (task.kind === 'keyword_ideas') {
        const siteId = tag.startsWith(KW_TAG) ? tag.slice(KW_TAG.length) : null
        if (!siteId) throw new Error(`unusable tag: ${tag || '(empty)'}`)
        result.keywordTasks += 1
        // Sound cast: task.kind chose which fetcher ran two branches up.
        await storeKeywordIdeas(supabase, siteId, fetched.result as KeywordIdeaItem[], result)
      } else {
        const keywordId = tag.startsWith(SERP_TAG) ? tag.slice(SERP_TAG.length) : null
        if (!keywordId) throw new Error(`unusable tag: ${tag || '(empty)'}`)
        result.serpTasks += 1
        const payload = (fetched.result as SerpTaskResult[])[0]
        if (!payload) throw new Error('task returned no result rows')
        await storeSerpSnapshot(supabase, keywordId, payload, result)
      }

      await supabase
        .from('seo_dfs_tasks')
        .update({ attempts, collected_at: new Date().toISOString(), last_error: null })
        .eq('id', task.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Left uncollected on purpose: the next tick retries until MAX_ATTEMPTS.
      await supabase.from('seo_dfs_tasks').update({ attempts, last_error: message }).eq('id', task.id)
      result.errors.push(`${task.kind} task ${task.id}: ${message}`)
    }
  }

  return result
}
