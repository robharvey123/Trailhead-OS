import { z } from 'zod'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/service'
import type { SeoPrompt, SeoSite } from '@/lib/types'

/**
 * AI visibility tracking (Growth Phase 6). Weekly: run each active buyer-intent
 * prompt against the configured answer engines, then score each raw answer with
 * a second (cheap) pass — brand mentioned?, position, competitors named. The
 * raw response is stored verbatim so a score can always be re-derived.
 *
 * Providers without an API key are skipped, never errored — Anthropic always
 * works (the OS already depends on it); OpenAI/Perplexity light up when their
 * keys are added.
 */

const CONCURRENCY = 6

type Provider = 'anthropic' | 'openai' | 'perplexity'

const ScoreSchema = z.object({
  brand_mentioned: z.boolean(),
  position: z.number().int().min(1).nullable(),
  competitors_mentioned: z.array(z.string()),
})

// ── Answer engines ───────────────────────────────────────────────────────────

async function askAnthropic(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.SONNET,
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

async function askOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    }),
  })
  if (!res.ok) {
    throw new Error(`${baseUrl} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content ?? ''
}

function configuredProviders(): Array<{ provider: Provider; ask: (prompt: string) => Promise<string> }> {
  const providers: Array<{ provider: Provider; ask: (prompt: string) => Promise<string> }> = []
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({ provider: 'anthropic', ask: askAnthropic })
  }
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_VISIBILITY_MODEL ?? 'gpt-4o'
    providers.push({
      provider: 'openai',
      ask: (p) => askOpenAiCompatible('https://api.openai.com/v1', process.env.OPENAI_API_KEY!, model, p),
    })
  }
  if (process.env.PERPLEXITY_API_KEY) {
    const model = process.env.PERPLEXITY_VISIBILITY_MODEL ?? 'sonar'
    providers.push({
      provider: 'perplexity',
      ask: (p) => askOpenAiCompatible('https://api.perplexity.ai', process.env.PERPLEXITY_API_KEY!, model, p),
    })
  }
  return providers
}

// ── Scoring pass ─────────────────────────────────────────────────────────────

const SCORE_SYSTEM = `You score an AI assistant's answer for brand visibility.

You are given a brand (name + domain) and an answer some AI assistant gave to a buyer question. Report:
- brand_mentioned: true only if THIS brand (or its domain) is genuinely mentioned or recommended.
- position: if the answer ranks or lists products/vendors, the 1-based position of the brand in that list; null if unmentioned or the answer has no ordering.
- competitors_mentioned: product/company names recommended in the answer that are NOT this brand (deduplicated, proper names only).

Return strict JSON only — no preamble, no code fences:
{ "brand_mentioned": boolean, "position": number | null, "competitors_mentioned": string[] }`

async function scoreAnswer(site: SeoSite, answer: string): Promise<z.infer<typeof ScoreSchema>> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.HAIKU,
    max_tokens: 800,
    system: SCORE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ brand: site.name, domain: site.domain, answer: answer.slice(0, 12_000) }),
      },
    ],
  })
  const block = response.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  const parsed = ScoreSchema.safeParse(JSON.parse(clean))
  if (!parsed.success) throw new Error('score response did not match schema')
  return parsed.data
}

// ── Orchestration ────────────────────────────────────────────────────────────

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run))
  }
}

export interface VisibilityRunResult {
  sites: number
  runs: number
  providers: Provider[]
  errors: string[]
}

export async function runVisibilityChecks(): Promise<VisibilityRunResult> {
  const supabase = createClient()
  const providers = configuredProviders()
  const result: VisibilityRunResult = {
    sites: 0,
    runs: 0,
    providers: providers.map((p) => p.provider),
    errors: [],
  }
  if (providers.length === 0) return result

  const { data: sites, error } = await supabase.from('seo_sites').select('*')
  if (error) throw new Error(error.message)

  for (const site of (sites ?? []) as SeoSite[]) {
    const { data: prompts } = await supabase
      .from('seo_prompts')
      .select('*')
      .eq('site_id', site.id)
      .eq('active', true)
    if (!prompts || prompts.length === 0) continue
    result.sites += 1

    const jobs = (prompts as SeoPrompt[]).flatMap((prompt) =>
      providers.map((p) => ({ prompt, ...p }))
    )
    await inBatches(jobs, CONCURRENCY, async (job) => {
      try {
        const answer = await job.ask(job.prompt.prompt)
        if (!answer.trim()) throw new Error('empty answer')
        const score = await scoreAnswer(site, answer)
        const { error: insertError } = await supabase.from('seo_ai_mentions').insert({
          site_id: site.id,
          prompt_id: job.prompt.id,
          provider: job.provider,
          brand_mentioned: score.brand_mentioned,
          position: score.position,
          competitors_mentioned: score.competitors_mentioned,
          raw_response: answer.slice(0, 20_000),
        })
        if (insertError) throw new Error(insertError.message)
        result.runs += 1
      } catch (err) {
        result.errors.push(
          `${site.domain}/${job.provider}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    })
  }
  return result
}

// ── Prompt seeding ───────────────────────────────────────────────────────────

const SEED_SYSTEM = `You write buyer-intent search prompts for tracking a brand's visibility in AI assistants.

Given a site's name, domain, ideal customer profile and brand voice, write 20 SHORT prompts a real buyer in that ICP would type into ChatGPT/Claude/Perplexity when looking for a product like this one. Mix: "best X for Y", "alternatives to <named competitor>", "cheapest X", feature-specific asks, and comparison questions. UK phrasing. Do NOT mention the brand itself in any prompt — the point is measuring whether the assistant brings it up.

Return strict JSON only — no preamble, no code fences:
{ "prompts": [ { "prompt": string, "category": string } ] }`

const SeedSchema = z.object({
  prompts: z.array(z.object({ prompt: z.string().min(5), category: z.string() })),
})

export async function seedPrompts(siteId: string): Promise<number> {
  const supabase = createClient()
  const { data: site } = await supabase.from('seo_sites').select('*').eq('id', siteId).single<SeoSite>()
  if (!site) throw new Error('Site not found')
  if (!site.icp) throw new Error('Set the site’s ideal customer profile in settings first — prompts are generated from it')

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.OPUS,
    max_tokens: 4000,
    system: SEED_SYSTEM,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          name: site.name,
          domain: site.domain,
          icp: site.icp,
          brand_voice: site.brand_voice,
        }),
      },
    ],
  })
  const block = response.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  const parsed = SeedSchema.safeParse(JSON.parse(clean))
  if (!parsed.success) throw new Error('Prompt seeding returned invalid JSON')

  const { data: existing } = await supabase.from('seo_prompts').select('prompt').eq('site_id', siteId)
  const known = new Set((existing ?? []).map((p) => (p.prompt as string).toLowerCase()))
  const fresh = parsed.data.prompts.filter((p) => !known.has(p.prompt.toLowerCase()))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from('seo_prompts')
    .insert(fresh.map((p) => ({ site_id: siteId, prompt: p.prompt, category: p.category })))
  if (error) throw new Error(error.message)
  return fresh.length
}
