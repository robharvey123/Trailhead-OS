import { z } from 'zod'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/service'
import { stripFences, textOf } from '@/lib/growth/ai'
import { requestSerpSnapshots } from '@/lib/growth/keywords'
import type { SeoSite } from '@/lib/types'

/**
 * B1: SERP-overlap clustering. Two keywords belong together when Google
 * returns substantially the same URLs for both — a measurement, not a guess.
 *
 * Graph: nodes are keywords, an edge joins A and B when their most recent
 * top-10 URL sets share ≥ threshold entries (site setting, default 3).
 * Connected components are the clusters; the pillar is the highest-volume
 * member (tie: lowest KD); the model only names the cluster.
 */

const MAX_KEYWORDS = 600
const MIN_MEMBERS = 2
const VOLUME_FLOOR = 10

interface KeywordNode {
  id: string
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  intent: string | null
  gsc_impressions: number | null
  top_urls: string[] | null
  top_domains: string[] | null
}

export interface OverlapReadiness {
  total: number
  withSnapshot: number
  missing: Array<{ id: string; keyword: string }>
  /** Snapshots already queued but not yet landed. */
  pending: number
}

async function loadNodes(siteId: string): Promise<KeywordNode[]> {
  const supabase = createClient()
  const { data: keywords, error } = await supabase
    .from('seo_keywords')
    .select('id, keyword, search_volume, keyword_difficulty, intent, gsc_impressions')
    .eq('site_id', siteId)
    .order('search_volume', { ascending: false, nullsFirst: false })
    .order('gsc_impressions', { ascending: false, nullsFirst: false })
    .limit(MAX_KEYWORDS)
  if (error) throw new Error(error.message)
  const ids = (keywords ?? []).map((k) => k.id as string)
  if (ids.length === 0) return []

  // Latest state per keyword.
  const { data: states } = await supabase
    .from('seo_serp_state')
    .select('keyword_id, top_urls, top_domains, captured_at')
    .in('keyword_id', ids)
    .order('captured_at', { ascending: false })
  const latest = new Map<string, { top_urls: string[]; top_domains: string[] }>()
  for (const s of states ?? []) {
    const kid = s.keyword_id as string
    if (!latest.has(kid)) latest.set(kid, { top_urls: s.top_urls as string[], top_domains: s.top_domains as string[] })
  }
  return (keywords ?? []).map((k) => ({
    id: k.id as string,
    keyword: k.keyword as string,
    search_volume: k.search_volume as number | null,
    keyword_difficulty: k.keyword_difficulty as number | null,
    intent: k.intent as string | null,
    gsc_impressions: k.gsc_impressions as number | null,
    top_urls: latest.get(k.id as string)?.top_urls ?? null,
    top_domains: latest.get(k.id as string)?.top_domains ?? null,
  }))
}

/** How much of the keyword set has SERP data — the confirmation step. */
export async function overlapReadiness(siteId: string): Promise<OverlapReadiness> {
  const nodes = await loadNodes(siteId)
  const missing = nodes.filter((n) => !n.top_urls).map((n) => ({ id: n.id, keyword: n.keyword }))
  const supabase = createClient()
  const { count } = await supabase
    .from('seo_dfs_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'serp')
    .is('collected_at', null)
    .in('tag', missing.map((m) => `serp:${m.id}`).slice(0, 500))
  return { total: nodes.length, withSnapshot: nodes.length - missing.length, missing, pending: count ?? 0 }
}

/** Queue snapshots for every keyword lacking one. Returns the number queued. */
export async function queueMissingSnapshots(siteId: string): Promise<number> {
  const readiness = await overlapReadiness(siteId)
  const supabase = createClient()
  const { data: pendingRows } = await supabase
    .from('seo_dfs_tasks')
    .select('tag')
    .eq('kind', 'serp')
    .is('collected_at', null)
  const pending = new Set((pendingRows ?? []).map((r) => r.tag as string))
  const toQueue = readiness.missing.filter((m) => !pending.has(`serp:${m.id}`))
  if (toQueue.length === 0) return 0
  await requestSerpSnapshots(toQueue)
  return toQueue.length
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(a)
  let n = 0
  for (const u of b) if (set.has(u)) n += 1
  return n
}

export interface OverlapCluster {
  members: KeywordNode[]
  pillar: KeywordNode
  /** Domains appearing in the top-10 of ≥ half the members — "who owns this topic". */
  sharedDomains: Array<{ domain: string; count: number }>
  avgOverlap: number
}

export function buildOverlapClusters(nodes: KeywordNode[], threshold: number): OverlapCluster[] {
  const withSerp = nodes.filter((n) => n.top_urls && n.top_urls.length > 0)
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root) as string
    let cur = x
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  for (const n of withSerp) parent.set(n.id, n.id)

  const overlaps = new Map<string, number[]>()
  for (let i = 0; i < withSerp.length; i++) {
    for (let j = i + 1; j < withSerp.length; j++) {
      const shared = overlap(withSerp[i].top_urls as string[], withSerp[j].top_urls as string[])
      if (shared >= threshold) {
        union(withSerp[i].id, withSerp[j].id)
        overlaps.set(withSerp[i].id, [...(overlaps.get(withSerp[i].id) ?? []), shared])
        overlaps.set(withSerp[j].id, [...(overlaps.get(withSerp[j].id) ?? []), shared])
      }
    }
  }

  const groups = new Map<string, KeywordNode[]>()
  for (const n of withSerp) {
    const root = find(n.id)
    groups.set(root, [...(groups.get(root) ?? []), n])
  }

  const clusters: OverlapCluster[] = []
  for (const members of groups.values()) {
    if (members.length < MIN_MEMBERS) {
      // Singletons only survive when they carry real volume on their own.
      const only = members[0]
      if ((only.search_volume ?? 0) < VOLUME_FLOOR * 10) continue
    }
    const pillar = [...members].sort(
      (a, b) =>
        (b.search_volume ?? 0) - (a.search_volume ?? 0) ||
        (a.keyword_difficulty ?? 101) - (b.keyword_difficulty ?? 101)
    )[0]
    const domainCounts = new Map<string, number>()
    for (const m of members) for (const d of new Set(m.top_domains ?? [])) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1)
    const sharedDomains = [...domainCounts.entries()]
      .filter(([, c]) => c >= Math.max(2, Math.ceil(members.length / 2)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([domain, count]) => ({ domain, count }))
    const all = members.flatMap((m) => overlaps.get(m.id) ?? [])
    clusters.push({
      members,
      pillar,
      sharedDomains,
      avgOverlap: all.length > 0 ? Math.round((all.reduce((s, v) => s + v, 0) / all.length) * 10) / 10 : 0,
    })
  }
  return clusters.sort(
    (a, b) =>
      b.members.reduce((s, m) => s + (m.search_volume ?? 0), 0) - a.members.reduce((s, m) => s + (m.search_volume ?? 0), 0)
  )
}

const NamesSchema = z.object({
  clusters: z.array(z.object({ index: z.number().int(), name: z.string().min(1), rationale: z.string(), priority: z.number().int().min(1).max(5) })),
})

const NAMES_SYSTEM = `You name topical clusters for an SEO content programme. Cluster membership has ALREADY been decided by SERP overlap (Google returns the same pages for these keywords), so do not merge, split or question the groups.

For each cluster you are given its index, pillar keyword, member keywords and the domains that dominate its results. Return a recognisable topic name a marketer would say out loud, a one-line rationale for why this topic is worth owning for THIS site's ICP, and a priority 1 (low) to 5 (highest commercial value).

Never output a search volume or difficulty figure.
Return strict JSON only — no preamble, no code fences:
{ "clusters": [ { "index": number, "name": string, "rationale": string, "priority": number } ] }`

export interface OverlapClusterResult {
  created: number
  assigned: number
  skippedNoSerp: number
  withSnapshot: number
  total: number
}

/** Propose clusters by SERP overlap for a site. Requires snapshots; keywords
 *  without one are left out and counted in `skippedNoSerp`. */
export async function generateOverlapClusters(site: SeoSite): Promise<OverlapClusterResult> {
  const supabase = createClient()
  const nodes = await loadNodes(site.id)
  const withSerp = nodes.filter((n) => n.top_urls)
  if (withSerp.length < 5) {
    throw new Error(
      `Only ${withSerp.length} of ${nodes.length} keywords have a SERP snapshot — queue snapshots first (they land within ~15 minutes)`
    )
  }
  const clusters = buildOverlapClusters(nodes, site.serp_overlap_threshold ?? 3)
  if (clusters.length === 0) throw new Error('No keyword pairs share enough top-10 URLs to form a cluster — lower the overlap threshold in settings')

  const payload = {
    domain: site.domain,
    icp: site.icp ?? 'not specified',
    clusters: clusters.map((c, index) => ({
      index,
      pillar_keyword: c.pillar.keyword,
      keywords: c.members.map((m) => m.keyword).slice(0, 40),
      dominant_domains: c.sharedDomains.map((d) => d.domain),
    })),
  }

  let names = new Map<number, { name: string; rationale: string; priority: number }>()
  let reason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = attempt === 0 ? NAMES_SYSTEM : `${NAMES_SYSTEM}\n\nYour previous response was rejected: ${reason}. Return ONLY valid JSON for the schema.`
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.SONNET,
      max_tokens: 6000,
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })
    try {
      const parsed = NamesSchema.safeParse(JSON.parse(stripFences(textOf(response))))
      if (!parsed.success) {
        reason = 'the response was not valid JSON for the schema'
        continue
      }
      names = new Map(parsed.data.clusters.map((c) => [c.index, c]))
      break
    } catch {
      reason = 'the response was not valid JSON'
    }
  }

  let created = 0
  let assigned = 0
  for (let index = 0; index < clusters.length; index++) {
    const c = clusters[index]
    const named = names.get(index)
    const intents = c.members.map((m) => m.intent).filter(Boolean) as string[]
    const intent = intents.length > 0
      ? [...intents.reduce((m, i) => m.set(i, (m.get(i) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null
    const { data: row, error } = await supabase
      .from('seo_clusters')
      .insert({
        site_id: site.id,
        name: named?.name ?? c.pillar.keyword,
        pillar_keyword: c.pillar.keyword,
        intent,
        priority: named?.priority ?? 3,
        method: 'serp_overlap',
        rationale: named?.rationale ?? null,
        evidence: { shared_domains: c.sharedDomains, avg_overlap: c.avgOverlap, member_count: c.members.length },
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    created += 1
    const { error: assignError } = await supabase
      .from('seo_keywords')
      .update({ cluster_id: row.id })
      .in('id', c.members.map((m) => m.id))
    if (assignError) throw new Error(assignError.message)
    assigned += c.members.length
  }

  return { created, assigned, skippedNoSerp: nodes.length - withSerp.length, withSnapshot: withSerp.length, total: nodes.length }
}
