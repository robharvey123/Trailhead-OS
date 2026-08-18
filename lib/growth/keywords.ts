import { createClient } from '@/lib/supabase/service'
import {
  getKeywordIdeasResult,
  getKeywordIdeasTasksReady,
  getSerpResult,
  getSerpTasksReady,
  postKeywordIdeasTask,
  postSerpTasks,
} from '@/lib/growth/dataforseo'

/**
 * DataForSEO orchestration (Growth module). Tasks are posted with a routing tag
 * (`kw:<site_id>` / `serp:<keyword_id>`); the growth-collect cron polls
 * tasks_ready and lands results — keyword ideas upsert into seo_keywords,
 * SERPs insert into seo_serp_snapshots. DataForSEO itself is the pending queue.
 */

const KW_TAG = 'kw:'
const SERP_TAG = 'serp:'

/** Queue keyword research for a site. Results land on the next collect tick. */
export async function requestKeywordIdeas(siteId: string, seeds: string[]): Promise<string> {
  const cleaned = seeds.map((s) => s.trim()).filter(Boolean)
  if (cleaned.length === 0) throw new Error('At least one seed keyword is required')
  return postKeywordIdeasTask(cleaned, `${KW_TAG}${siteId}`)
}

/** Queue SERP snapshots for keywords (id → keyword text). */
export async function requestSerpSnapshots(keywords: Array<{ id: string; keyword: string }>) {
  return postSerpTasks(keywords.map((k) => ({ keyword: k.keyword, tag: `${SERP_TAG}${k.id}` })))
}

export interface CollectResult {
  keywordTasks: number
  keywordsUpserted: number
  serpTasks: number
  snapshotsStored: number
  errors: string[]
}

/** Cron entry point — drain everything DataForSEO has finished since last tick. */
export async function collectReadyResults(): Promise<CollectResult> {
  const supabase = createClient()
  const result: CollectResult = {
    keywordTasks: 0,
    keywordsUpserted: 0,
    serpTasks: 0,
    snapshotsStored: 0,
    errors: [],
  }

  // ── Keyword ideas ──
  for (const task of await getKeywordIdeasTasksReady()) {
    try {
      const { tag: resultTag, items } = await getKeywordIdeasResult(task.id)
      const tag = resultTag ?? task.tag // tasks_ready carries the tag too
      const siteId = tag?.startsWith(KW_TAG) ? tag.slice(KW_TAG.length) : null
      if (!siteId) continue // not ours (e.g. posted from the DataForSEO dashboard)
      result.keywordTasks += 1

      const now = new Date().toISOString()
      const { data: existing, error: existingError } = await supabase
        .from('seo_keywords')
        .select('keyword')
        .eq('site_id', siteId)
      if (existingError) throw new Error(existingError.message)
      const known = new Set((existing ?? []).map((k) => k.keyword as string))

      const seen = new Set<string>()
      const rows = items
        .map((item) => ({ ...item, keyword: item.keyword?.trim().toLowerCase() ?? '' }))
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
      const updates = items
        .map((item) => ({ ...item, keyword: item.keyword?.trim().toLowerCase() ?? '' }))
        .filter((item) => item.keyword && known.has(item.keyword))
      for (const item of updates) {
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
        result.keywordsUpserted += 1
      }
    } catch (err) {
      result.errors.push(`keyword task ${task.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── SERP snapshots ──
  for (const task of await getSerpTasksReady()) {
    try {
      const { tag: resultTag, result: serp } = await getSerpResult(task.id)
      const tag = resultTag ?? task.tag // tasks_ready carries the tag too
      const keywordId = tag?.startsWith(SERP_TAG) ? tag.slice(SERP_TAG.length) : null
      if (!keywordId) continue
      result.serpTasks += 1

      const payload = serp[0]
      if (!payload) continue
      const { error } = await supabase
        .from('seo_serp_snapshots')
        .insert({ keyword_id: keywordId, results: payload })
      if (error) throw new Error(error.message)
      result.snapshotsStored += 1
    } catch (err) {
      result.errors.push(`serp task ${task.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
