import { z } from 'zod'
import type { Message } from '@anthropic-ai/sdk/resources/messages'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/service'
import { requestSerpSnapshots } from '@/lib/growth/keywords'
import { fetchHeadings } from '@/lib/growth/page-fetch'
import type { SeoBrief, SeoCluster, SeoKeyword, SeoSite } from '@/lib/types'

/**
 * Growth engine model calls: keyword list → clusters → briefs → drafts.
 *
 * Hard rule carried through every prompt: the model NEVER produces a search
 * volume or difficulty figure — those come from DataForSEO/GSC or stay null.
 * All calls follow the narrative.ts convention: strict-JSON system prompt,
 * defensive fence-stripping parse, zod validation, one corrective retry.
 */

const MAX_KEYWORDS_FOR_CLUSTERING = 500

// £-relevant: rough list-price per token for the models in use, to fill
// seo_articles.token_cost. Estimates, not billing data.
const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  [ANTHROPIC_MODELS.OPUS]: { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  [ANTHROPIC_MODELS.SONNET]: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
}

export function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
}

export function textOf(response: Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

// ── Clusters ─────────────────────────────────────────────────────────────────

const ClustersSchema = z.object({
  clusters: z.array(
    z.object({
      name: z.string().min(1),
      pillar_keyword: z.string().min(1),
      intent: z.string(),
      priority: z.number().int().min(1).max(5),
      keywords: z.array(z.string()),
    })
  ),
})

const CLUSTERS_SYSTEM = `You are an SEO strategist grouping a keyword list into topical clusters for a content programme.

You are given the site's domain, ideal customer profile, brand voice and its keyword list. Group the keywords into topical clusters a single pillar article (plus supporting articles) could own.

Rules:
- Every pillar_keyword and every entry in keywords MUST be copied verbatim from the provided keyword list. Do not invent keywords.
- Never output a search volume, difficulty or any other metric. You do not know them.
- intent is one of: informational, commercial, transactional, navigational. Where a keyword carries a measured intent field (from DataForSEO), the cluster's intent MUST reflect the measured intents of its members — do not overrule measured data with a guess.
- priority is 1 (low) to 5 (highest commercial value for THIS site's ICP).
- 4 to 10 clusters. Leave keywords that fit nowhere out entirely.
- Cluster names are recognisable topics a marketer would say out loud, not keyword strings.

Return strict JSON only — no preamble, no code fences:
{ "clusters": [ { "name": string, "pillar_keyword": string, "intent": string, "priority": number, "keywords": string[] } ] }`

export async function generateClusters(siteId: string): Promise<{ created: number; assigned: number }> {
  const supabase = createClient()
  const { data: site } = await supabase.from('seo_sites').select('*').eq('id', siteId).single<SeoSite>()
  if (!site) throw new Error('Site not found')

  const { data: keywords, error: kwError } = await supabase
    .from('seo_keywords')
    .select('id, keyword, search_volume, gsc_clicks, gsc_impressions, intent, intent_source, keyword_difficulty')
    .eq('site_id', siteId)
    .order('search_volume', { ascending: false, nullsFirst: false })
    .limit(MAX_KEYWORDS_FOR_CLUSTERING)
  if (kwError) throw new Error(kwError.message)
  if (!keywords || keywords.length < 5) {
    throw new Error('Not enough keywords to cluster — run keyword research or a GSC sync first')
  }

  const payload = {
    domain: site.domain,
    icp: site.icp ?? 'not specified',
    brand_voice: site.brand_voice ?? 'not specified',
    keywords: keywords.map((k) => ({
      keyword: k.keyword,
      volume: k.search_volume,
      difficulty: k.keyword_difficulty,
      gsc_clicks: k.gsc_clicks,
      gsc_impressions: k.gsc_impressions,
      // Measured intent (A1) goes in as a fact; the model only guesses where it is missing.
      intent: k.intent_source === 'dataforseo' ? k.intent : undefined,
    })),
  }

  let reason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = attempt === 0 ? CLUSTERS_SYSTEM : `${CLUSTERS_SYSTEM}\n\nYour previous response was rejected: ${reason}. Return ONLY valid JSON for the schema.`
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.OPUS,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })

    let parsed: z.infer<typeof ClustersSchema>
    try {
      const result = ClustersSchema.safeParse(JSON.parse(stripFences(textOf(response))))
      if (!result.success) {
        reason = 'the response was not valid JSON for the schema'
        continue
      }
      parsed = result.data
    } catch {
      reason = 'the response was not valid JSON'
      continue
    }

    // Only keep model output that maps back to real keyword rows.
    const byKeyword = new Map(keywords.map((k) => [k.keyword.toLowerCase(), k.id as string]))
    let created = 0
    let assigned = 0
    for (const cluster of parsed.clusters) {
      const memberIds = cluster.keywords
        .map((k) => byKeyword.get(k.trim().toLowerCase()))
        .filter((id): id is string => Boolean(id))
      if (memberIds.length === 0) continue

      const { data: row, error } = await supabase
        .from('seo_clusters')
        .insert({
          site_id: siteId,
          name: cluster.name,
          pillar_keyword: byKeyword.has(cluster.pillar_keyword.trim().toLowerCase())
            ? cluster.pillar_keyword.trim().toLowerCase()
            : null,
          intent: cluster.intent,
          priority: cluster.priority,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      created += 1

      const { error: assignError } = await supabase
        .from('seo_keywords')
        .update({ cluster_id: row.id })
        .in('id', memberIds)
      if (assignError) throw new Error(assignError.message)
      assigned += memberIds.length

      // Model-guessed intent is the FALLBACK only: never overwrite a measured one.
      await supabase
        .from('seo_keywords')
        .update({ intent: cluster.intent, intent_source: 'model' })
        .in('id', memberIds)
        .is('intent', null)
    }

    if (created === 0) {
      reason = 'no cluster used keywords from the provided list'
      continue
    }
    return { created, assigned }
  }
  throw new Error(`Cluster generation failed: ${reason}`)
}

// ── Briefs ───────────────────────────────────────────────────────────────────

const BriefSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  target_keyword: z.string(),
  secondary_keywords: z.array(z.string()),
  intent: z.string(),
  word_target: z.number().int().min(600).max(4000),
  outline: z.object({
    angle: z.string(),
    sections: z.array(z.object({ heading: z.string(), notes: z.string() })),
    faq: z.array(z.object({ question: z.string() })),
  }),
  internal_links: z.array(z.object({ anchor: z.string(), url: z.string() })),
})

const BRIEF_SYSTEM = `You are an SEO content strategist writing an article brief.

You are given: the site's context, the target (pillar) keyword, the cluster's supporting keywords, the current top-10 Google results for the target keyword, the H1/H2 heading structure of the top-ranking pages, People Also Ask questions, a list of the site's published articles available for internal linking, and (optionally) angles_proven_in_paid_social — ad hooks that have already earned attention from this audience; treat them as tested angles worth reflecting in the title and opening, not as copy to reuse verbatim.

Rules:
- The outline must cover the topics the top-ranking pages cover, PLUS at least one angle none of them have. Name that angle explicitly in outline.angle.
- faq comes from the People Also Ask questions provided (reworded is fine). If none were provided, propose 3-5 questions a buyer would ask.
- internal_links may ONLY use URLs from the provided published-articles list. If the list is empty, return an empty array. Never invent a URL.
- secondary_keywords come from the provided cluster keywords.
- word_target defaults to the 1200-1800 range unless the SERP clearly demands longer.
- Never output a search volume or difficulty figure.
- slug is lowercase-hyphenated, no leading slash.

Return strict JSON only — no preamble, no code fences:
{ "title": string, "slug": string, "target_keyword": string, "secondary_keywords": string[], "intent": string, "word_target": number, "outline": { "angle": string, "sections": [ { "heading": string, "notes": string } ], "faq": [ { "question": string } ] }, "internal_links": [ { "anchor": string, "url": string } ] }`

interface SerpItem {
  type?: string
  title?: string
  url?: string
  domain?: string
  description?: string
  items?: Array<{ title?: string; question?: string }>
}

export async function generateBrief(clusterId: string): Promise<string> {
  const supabase = createClient()
  const { data: cluster } = await supabase
    .from('seo_clusters')
    .select('*')
    .eq('id', clusterId)
    .single<SeoCluster>()
  if (!cluster) throw new Error('Cluster not found')
  if (!cluster.pillar_keyword) throw new Error('Cluster has no pillar keyword')

  const { data: site } = await supabase
    .from('seo_sites')
    .select('*')
    .eq('id', cluster.site_id)
    .single<SeoSite>()
  if (!site) throw new Error('Site not found')

  const { data: pillarRow } = await supabase
    .from('seo_keywords')
    .select('id, keyword')
    .eq('site_id', cluster.site_id)
    .eq('keyword', cluster.pillar_keyword)
    .maybeSingle()
  if (!pillarRow) throw new Error(`Pillar keyword "${cluster.pillar_keyword}" is not in the keyword list`)

  const { data: snapshot } = await supabase
    .from('seo_serp_snapshots')
    .select('results, captured_at')
    .eq('keyword_id', pillarRow.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) {
    await requestSerpSnapshots([{ id: pillarRow.id as string, keyword: pillarRow.keyword as string }])
    throw new Error(
      `No SERP snapshot for "${cluster.pillar_keyword}" yet — one has been queued and lands within ~15 minutes. Try again then.`
    )
  }

  const items = ((snapshot.results as { items?: SerpItem[] }).items ?? [])
  const organic = items.filter((i) => i.type === 'organic').slice(0, 10)
  const paa = items
    .filter((i) => i.type === 'people_also_ask')
    .flatMap((i) => i.items ?? [])
    .map((q) => q.title ?? q.question)
    .filter((q): q is string => Boolean(q))

  const headingResults = await Promise.all(
    organic.slice(0, 5).map((r) => (r.url ? fetchHeadings(r.url) : Promise.resolve(null)))
  )

  const { data: clusterKeywords } = await supabase
    .from('seo_keywords')
    .select('keyword')
    .eq('cluster_id', clusterId)
  const { data: published } = await supabase
    .from('seo_articles')
    .select('title, published_url')
    .eq('site_id', cluster.site_id)
    .eq('status', 'published')
    .not('published_url', 'is', null)

  // E3.1: hooks that have already earned attention from this audience in paid
  // social — the top decile of Meta creatives by CTR. Empty when no Meta account.
  const { winningAngles } = await import('@/lib/growth/paid-loops')
  const provenAngles = await winningAngles(cluster.site_id).catch(() => [])

  const payload = {
    site: { domain: site.domain, icp: site.icp, brand_voice: site.brand_voice },
    target_keyword: cluster.pillar_keyword,
    cluster: { name: cluster.name, intent: cluster.intent },
    cluster_keywords: (clusterKeywords ?? []).map((k) => k.keyword),
    serp_top10: organic.map((r) => ({ title: r.title, url: r.url, domain: r.domain, description: r.description })),
    competitor_headings: headingResults.filter(Boolean),
    people_also_ask: paa,
    published_articles: (published ?? []).map((a) => ({ title: a.title, url: a.published_url })),
    angles_proven_in_paid_social: provenAngles,
  }

  let reason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = attempt === 0 ? BRIEF_SYSTEM : `${BRIEF_SYSTEM}\n\nYour previous response was rejected: ${reason}. Return ONLY valid JSON for the schema.`
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.OPUS,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })

    let parsed: z.infer<typeof BriefSchema>
    try {
      const result = BriefSchema.safeParse(JSON.parse(stripFences(textOf(response))))
      if (!result.success) {
        reason = 'the response was not valid JSON for the schema'
        continue
      }
      parsed = result.data
    } catch {
      reason = 'the response was not valid JSON'
      continue
    }

    // No invented internal links, full stop.
    const allowedUrls = new Set((published ?? []).map((a) => a.published_url as string))
    const internalLinks = parsed.internal_links.filter((l) => allowedUrls.has(l.url))

    const { data: row, error } = await supabase
      .from('seo_briefs')
      .insert({
        site_id: cluster.site_id,
        cluster_id: clusterId,
        title: parsed.title,
        slug: parsed.slug.replace(/^\//, ''),
        target_keyword: cluster.pillar_keyword,
        secondary_keywords: parsed.secondary_keywords,
        intent: parsed.intent,
        outline: parsed.outline,
        word_target: parsed.word_target,
        internal_links: internalLinks,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return row.id as string
  }
  throw new Error(`Brief generation failed: ${reason}`)
}

// ── Drafts ───────────────────────────────────────────────────────────────────

const DRAFT_SYSTEM = `You are writing a full article for a website, from an approved brief.

Non-negotiable rules:
- Every claim about a competitor, a price, a regulation or a statistic needs a source URL in the body (markdown link). No source, cut the claim.
- No em dashes. Use commas, full stops or parentheses.
- British English throughout.
- Open with the answer: the first paragraph directly answers the search intent, no throat-clearing.
- Length: hit the brief's word target (within ~15%) unless the brief says otherwise.
- End with an FAQ section answering the questions in the brief's outline.
- Include the internal links EXACTLY as the brief specifies (same anchor, same URL). Do not add any other internal links. Never invent a URL.
- Match the site's brand voice. Never output a search volume or keyword metric.
- Format as clean markdown: one H1 (the title), H2 sections per the outline, short paragraphs.

Respond in EXACTLY this delimited format, nothing before or after:
---META---
A single meta description, max 155 characters, plain text.
---JSONLD---
A single JSON object: schema.org Article JSON-LD for this piece (headline, description, author as the site name, plus a FAQPage mainEntity for the FAQ questions).
---BODY---
The full article in markdown.`

export interface DraftResult {
  body_mdx: string
  meta_description: string
  schema_jsonld: Record<string, unknown> | null
  word_count: number
  model_used: string
  token_cost: number
}

export async function draftArticle(brief: SeoBrief, site: SeoSite): Promise<DraftResult> {
  const supabase = createClient()
  const { data: clusterKeywords } = brief.cluster_id
    ? await supabase.from('seo_keywords').select('keyword').eq('cluster_id', brief.cluster_id)
    : { data: [] as Array<Pick<SeoKeyword, 'keyword'>> }

  const payload = {
    site: { name: site.name, domain: site.domain, icp: site.icp, brand_voice: site.brand_voice },
    brief: {
      title: brief.title,
      target_keyword: brief.target_keyword,
      secondary_keywords: brief.secondary_keywords,
      intent: brief.intent,
      word_target: brief.word_target ?? 1500,
      outline: brief.outline,
      internal_links: brief.internal_links,
    },
    cluster_keywords: (clusterKeywords ?? []).map((k) => k.keyword),
  }

  const model = ANTHROPIC_MODELS.OPUS
  const response = await anthropic.messages.create({
    model,
    max_tokens: 12000,
    system: DRAFT_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })

  const text = textOf(response)
  const metaMatch = text.match(/---META---\s*([\s\S]*?)\s*---JSONLD---/)
  const jsonldMatch = text.match(/---JSONLD---\s*([\s\S]*?)\s*---BODY---/)
  const bodyMatch = text.match(/---BODY---\s*([\s\S]*)$/)
  if (!metaMatch || !bodyMatch) {
    throw new Error('Draft response did not follow the expected format')
  }

  let schemaJsonld: Record<string, unknown> | null = null
  if (jsonldMatch) {
    try {
      schemaJsonld = JSON.parse(stripFences(jsonldMatch[1])) as Record<string, unknown>
    } catch {
      schemaJsonld = null // draft still usable; schema can be regenerated at publish time
    }
  }

  const body = bodyMatch[1].trim()
  const prices = TOKEN_PRICES[model] ?? { input: 0, output: 0 }
  const cost =
    response.usage.input_tokens * prices.input + response.usage.output_tokens * prices.output

  return {
    body_mdx: body,
    meta_description: metaMatch[1].trim().slice(0, 200),
    schema_jsonld: schemaJsonld,
    word_count: body.split(/\s+/).filter(Boolean).length,
    model_used: model,
    token_cost: Math.round(cost * 10_000) / 10_000,
  }
}
