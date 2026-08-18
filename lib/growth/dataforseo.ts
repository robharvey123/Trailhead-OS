/**
 * DataForSEO API client (Growth module). Standard (task) queue ONLY — never the
 * Live endpoints: identical data at $0.0006/SERP vs $0.002 Live, and everything
 * here runs on a cron cadence where minutes of latency are free.
 *
 * Flow: task_post with a `tag` we can route on → the growth-collect cron polls
 * tasks_ready → task_get per completed task → results upserted by the caller
 * (lib/growth/keywords.ts). No pending-task table needed; DataForSEO holds the
 * queue and tasks_ready only returns uncollected tasks.
 */

const BASE_URL = 'https://api.dataforseo.com/v3'

// UK, English — per the brief. `depth` left at default (it multiplies cost).
export const UK_LOCATION_CODE = 2826
export const LANGUAGE_CODE = 'en'

interface DfsTask<T> {
  id: string
  status_code: number
  status_message: string
  /** Present on task_post/tasks_ready responses… */
  tag?: string
  /** …but on task_get the tag is echoed inside the original request payload. */
  data?: { tag?: string }
  result: T[] | null
}

interface DfsResponse<T> {
  status_code: number
  status_message: string
  tasks: DfsTask<T>[] | null
}

export interface SerpTaskResult {
  keyword: string
  item_types?: string[]
  items: Array<Record<string, unknown>> | null
}

export interface KeywordIdeaItem {
  keyword: string
  search_volume: number | null
  competition_index: number | null
  cpc: number | null
}

export interface ReadyTask {
  id: string
  tag: string | null
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new Error('DataForSEO not configured — set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD')
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

async function dfsFetch<T>(path: string, body?: unknown): Promise<DfsResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`DataForSEO ${path} failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
  const json = (await res.json()) as DfsResponse<T>
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO ${path} error ${json.status_code}: ${json.status_message}`)
  }
  return json
}

/** Queue SERP tasks (Standard queue). Returns posted task ids keyed by tag. */
export async function postSerpTasks(
  items: Array<{ keyword: string; tag: string }>,
  location = UK_LOCATION_CODE
): Promise<Array<{ id: string; tag: string | null }>> {
  if (items.length === 0) return []
  const payload = items.map((item) => ({
    keyword: item.keyword,
    location_code: location,
    language_code: LANGUAGE_CODE,
    tag: item.tag,
  }))
  const json = await dfsFetch<never>('/serp/google/organic/task_post', payload)
  // Individual tasks can fail (20100 = created); surface hard failures.
  const tasks = json.tasks ?? []
  const failed = tasks.filter((t) => t.status_code !== 20100)
  if (failed.length > 0) {
    throw new Error(`DataForSEO rejected ${failed.length} SERP task(s): ${failed[0].status_message}`)
  }
  return tasks.map((t) => ({ id: t.id, tag: t.tag ?? null }))
}

/** Queue a keyword-ideas task (Google Ads data, Standard queue). */
export async function postKeywordIdeasTask(
  seeds: string[],
  tag: string,
  location = UK_LOCATION_CODE
): Promise<string> {
  const json = await dfsFetch<never>('/keywords_data/google_ads/keywords_for_keywords/task_post', [
    {
      keywords: seeds,
      location_code: location,
      language_code: LANGUAGE_CODE,
      tag,
    },
  ])
  const task = json.tasks?.[0]
  if (!task || task.status_code !== 20100) {
    throw new Error(`DataForSEO rejected keyword ideas task: ${task?.status_message ?? 'no task returned'}`)
  }
  return task.id
}

/** Completed-but-uncollected SERP tasks. */
export async function getSerpTasksReady(): Promise<ReadyTask[]> {
  const json = await dfsFetch<{ id: string; tag: string | null }>('/serp/google/organic/tasks_ready')
  return (json.tasks ?? []).flatMap((t) => t.result ?? []).map((r) => ({ id: r.id, tag: r.tag ?? null }))
}

/** Completed-but-uncollected keyword-ideas tasks. */
export async function getKeywordIdeasTasksReady(): Promise<ReadyTask[]> {
  const json = await dfsFetch<{ id: string; tag: string | null }>(
    '/keywords_data/google_ads/keywords_for_keywords/tasks_ready'
  )
  return (json.tasks ?? []).flatMap((t) => t.result ?? []).map((r) => ({ id: r.id, tag: r.tag ?? null }))
}

/** Fetch one completed SERP task's results. */
export async function getSerpResult(taskId: string): Promise<{ tag: string | null; result: SerpTaskResult[] }> {
  const json = await dfsFetch<SerpTaskResult>(`/serp/google/organic/task_get/regular/${taskId}`)
  const task = json.tasks?.[0]
  if (!task) throw new Error(`DataForSEO SERP task ${taskId}: no task in response`)
  return { tag: task.tag ?? task.data?.tag ?? null, result: task.result ?? [] }
}

export function dataForSeoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
}

/**
 * Backlinks summary — referring-domain count for the Growth Score. The
 * backlinks API is Live-only (no Standard queue exists for it); one call per
 * site per night from the growth-score cron, never per render.
 */
export async function getBacklinksSummary(
  target: string
): Promise<{ referring_domains: number; backlinks: number }> {
  const json = await dfsFetch<{ referring_domains: number; backlinks: number }>(
    '/backlinks/summary/live',
    [{ target, include_subdomains: true }]
  )
  const result = json.tasks?.[0]?.result?.[0]
  if (!result) throw new Error(`DataForSEO backlinks summary for ${target}: no result`)
  return { referring_domains: result.referring_domains ?? 0, backlinks: result.backlinks ?? 0 }
}

export interface BacklinkItem {
  url_from: string
  domain_from: string
  page_from_title: string | null
  domain_from_rank: number | null
}

/**
 * A competitor's backlinks, one per referring domain (Live — the backlinks API
 * has no Standard queue). Used by prospect import; caller filters and maps
 * into the CRM.
 */
export async function getCompetitorBacklinks(
  target: string,
  limit = 100
): Promise<BacklinkItem[]> {
  const json = await dfsFetch<{ items: BacklinkItem[] | null }>('/backlinks/backlinks/live', [
    {
      target,
      mode: 'one_per_domain',
      limit,
      order_by: ['domain_from_rank,desc'],
      exclude_internal_backlinks: true,
    },
  ])
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  const targetHost = target.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  // Pages the competitor owns are not prospects.
  return items.filter(
    (i) => i.domain_from && !i.domain_from.toLowerCase().endsWith(targetHost)
  )
}

/** Fetch one completed keyword-ideas task's results. */
export async function getKeywordIdeasResult(
  taskId: string
): Promise<{ tag: string | null; items: KeywordIdeaItem[] }> {
  const json = await dfsFetch<KeywordIdeaItem>(
    `/keywords_data/google_ads/keywords_for_keywords/task_get/${taskId}`
  )
  const task = json.tasks?.[0]
  if (!task) throw new Error(`DataForSEO keyword ideas task ${taskId}: no task in response`)
  return { tag: task.tag ?? task.data?.tag ?? null, items: task.result ?? [] }
}
