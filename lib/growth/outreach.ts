import { z } from 'zod'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/service'
import { markdownToHtml } from '@/lib/growth/publish'
import type { SeoArticle, SeoLinkTarget, SeoSite } from '@/lib/types'

/**
 * Automated link outreach (built on the existing outreach engine).
 *
 * Chain: find the editor's contact on the prospect site (scrape + Haiku
 * extraction) → Claude drafts a personalised pitch referencing the page that
 * links to the competitor → human approves on the Links page → the pitch is
 * queued into a per-site engine campaign whose template renders the
 * per-recipient vars. The ENGINE then owns everything downstream: send window,
 * daily cap, suppression, unsubscribe/one-click headers, the 7-day follow-up
 * step, and stop-on-reply.
 *
 * The human gate is the approve click. Nothing here sends an email directly.
 */

const CONTACT_PAGES = ['', '/contact', '/about', '/write-for-us', '/contribute', '/about-us']
const FETCH_TIMEOUT_MS = 8000
const PAGE_TEXT_LIMIT = 6000

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrailheadGrowth/1.0)' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 400_000)
    // mailto: targets are the highest-signal contact data — keep them visible in the text.
    const mailtos = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => m[1]).slice(0, 10)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PAGE_TEXT_LIMIT)
    return (mailtos.length > 0 ? `MAILTO LINKS: ${mailtos.join(', ')}\n` : '') + text
  } catch {
    return null
  }
}

// ── 1. Contact finding ───────────────────────────────────────────────────────

const ContactSchema = z.object({
  found: z.boolean(),
  name: z.string().nullable(),
  role: z.string().nullable(),
  email: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string(),
})

const CONTACT_SYSTEM = `You extract the best outreach contact for a link-building pitch from a website's pages.

You are given text scraped from a site's homepage/contact/about/write-for-us pages (mailto links are listed explicitly). Find the single best person to pitch an article to: an editor, content lead, marketing manager, or named founder — with a REAL email address that appears in the text.

Rules:
- The email must literally appear in the provided text (including the MAILTO LINKS). Never construct or guess an address.
- Prefer a named person over generic inboxes; a generic inbox (hello@, editor@, info@) is acceptable at confidence "low"/"medium" with name null.
- Ignore emails on unrelated domains (analytics, CDNs, example.com).
- note: one sentence on where you found it / why this person, or why nothing usable exists.

Return strict JSON only — no preamble, no code fences:
{ "found": boolean, "name": string | null, "role": string | null, "email": string | null, "confidence": "high" | "medium" | "low", "note": string }`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface ContactFindResult {
  found: boolean
  note: string
}

export async function findProspectContact(targetId: string): Promise<ContactFindResult> {
  const supabase = createClient()
  const { data: target } = await supabase
    .from('seo_link_targets')
    .select('*, accounts:crm_account_id(id, name, website)')
    .eq('id', targetId)
    .single()
  if (!target) throw new Error('Link target not found')
  const account = target.accounts as unknown as { id: string; name: string; website: string | null } | null
  const baseUrl = (account?.website ?? `https://${account?.name ?? ''}`).replace(/\/$/, '')
  if (!baseUrl.includes('.')) throw new Error('Prospect has no usable website')

  const pages = (
    await Promise.all(
      CONTACT_PAGES.map(async (path) => {
        const text = await fetchPageText(`${baseUrl}${path}`)
        return text ? `=== ${path || '/'} ===\n${text}` : null
      })
    )
  ).filter(Boolean)

  const finish = async (fields: Record<string, unknown>, result: ContactFindResult) => {
    await supabase
      .from('seo_link_targets')
      .update({ contact_search_at: new Date().toISOString(), ...fields })
      .eq('id', targetId)
    return result
  }

  if (pages.length === 0) {
    return finish(
      { contact_note: 'Site unreachable — no pages could be fetched' },
      { found: false, note: 'Site unreachable' }
    )
  }

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.HAIKU,
    max_tokens: 600,
    system: CONTACT_SYSTEM,
    messages: [{ role: 'user', content: pages.join('\n\n').slice(0, 30_000) }],
  })
  const block = response.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()

  let parsed: z.infer<typeof ContactSchema>
  try {
    const result = ContactSchema.safeParse(JSON.parse(clean))
    if (!result.success) throw new Error('bad shape')
    parsed = result.data
  } catch {
    return finish(
      { contact_note: 'Contact extraction returned invalid JSON' },
      { found: false, note: 'Extraction failed — retry later' }
    )
  }

  const email = parsed.email?.trim().toLowerCase() ?? ''
  if (!parsed.found || !email || !EMAIL_RE.test(email)) {
    return finish(
      { contact_note: parsed.note || 'No usable contact found' },
      { found: false, note: parsed.note || 'No usable contact found' }
    )
  }

  // Find-or-create the contact on the prospect account.
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  let contactId = existing?.id as string | undefined
  if (!contactId) {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        name: parsed.name || account?.name || email,
        email,
        role: parsed.role,
        account_id: account?.id ?? null,
        company: account?.name ?? null,
        status: 'lead',
        channel: 'seo-link',
        notes: `Found by Growth contact search (${parsed.confidence} confidence): ${parsed.note}`,
        email_greeting: parsed.name ? parsed.name.split(' ')[0] : null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    contactId = created.id as string
  }

  return finish(
    { contact_id: contactId, contact_note: `${parsed.confidence} confidence: ${parsed.note}` },
    { found: true, note: parsed.note }
  )
}

// ── 2. Pitch drafting ────────────────────────────────────────────────────────

const PitchSchema = z.object({
  subject: z.string().min(3).max(120),
  body_markdown: z.string().min(50),
  article_slug: z.string(),
})

const PITCH_SYSTEM = `You write a short, genuinely personalised link-outreach email pitching one article to a site that already links to a competitor.

You are given: the pitching site's context and brand voice, the prospect page that links to the competitor (with an excerpt), the contact's name if known, and the published articles available to pitch. Pick the ONE article that best fits their page and write the pitch.

Rules:
- Reference something SPECIFIC from their page in the first two sentences — prove a human read it. Never open with "I hope this finds you well".
- The ask: consider adding/updating a link to our article where they currently reference the competitor resource. One clear ask only.
- Under 160 words. British English. No em dashes. Plain text paragraphs (markdown only for the one article link).
- Include the article link exactly once, as a markdown link.
- Honest sender: Rob from the site's team. No fake flattery, no "quick question" subject bait. Subject: specific and plain, under 60 characters.
- article_slug must be one of the provided slugs, verbatim.

Return strict JSON only — no preamble, no code fences:
{ "subject": string, "body_markdown": string, "article_slug": string }`

export async function draftPitch(targetId: string): Promise<void> {
  const supabase = createClient()
  const { data: target } = await supabase
    .from('seo_link_targets')
    .select('*, accounts:crm_account_id(name), contacts:contact_id(name, email_greeting)')
    .eq('id', targetId)
    .single()
  if (!target) throw new Error('Link target not found')
  if (!target.contact_id) throw new Error('Find a contact first — pitches are only drafted for a named recipient')

  const { data: site } = await supabase
    .from('seo_sites')
    .select('*')
    .eq('id', target.site_id)
    .single<SeoSite>()
  if (!site) throw new Error('Site not found')

  const { data: articles } = await supabase
    .from('seo_articles')
    .select('id, title, slug, meta_description, published_url')
    .eq('site_id', site.id)
    .eq('status', 'published')
    .not('published_url', 'is', null)
  if (!articles || articles.length === 0) {
    throw new Error('No published articles to pitch — publish at least one article first')
  }

  const pageText = await fetchPageText(target.url as string)
  const contact = target.contacts as unknown as { name: string | null; email_greeting: string | null } | null

  const payload = {
    site: { name: site.name, domain: site.domain, brand_voice: site.brand_voice, icp: site.icp },
    prospect_page: { url: target.url, angle: target.angle, excerpt: pageText ?? '(page unreachable — rely on the angle)' },
    contact_first_name: contact?.email_greeting ?? contact?.name?.split(' ')[0] ?? null,
    articles: articles.map((a) => ({ slug: a.slug, title: a.title, summary: a.meta_description, url: a.published_url })),
  }

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODELS.OPUS,
    max_tokens: 2500,
    system: PITCH_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  })
  const block = response.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  const parsed = PitchSchema.safeParse(JSON.parse(clean))
  if (!parsed.success) throw new Error('Pitch generation returned invalid JSON — try again')

  const article = articles.find((a) => a.slug === parsed.data.article_slug) ?? articles[0]
  const { error } = await supabase
    .from('seo_link_targets')
    .update({
      pitch_subject: parsed.data.subject,
      pitch_body: parsed.data.body_markdown,
      pitch_generated_at: new Date().toISOString(),
      pitch_article_id: article.id,
    })
    .eq('id', targetId)
  if (error) throw new Error(error.message)
}

// ── 3. Engine handoff ────────────────────────────────────────────────────────

const PITCH_TEMPLATE_NAME = 'Growth link pitch (per-recipient vars)'
const FOLLOWUP_TEMPLATE_NAME = 'Growth link follow-up'

const FOLLOWUP_BODY = `<p>Hi {{email_greeting}},</p>
<p>Just floating this back up in case it got buried. The piece I mentioned is here: <a href="{{article_url}}">{{article_title}}</a>.</p>
<p>If it is not a fit for {{their_page_host}}, no problem at all — I will not chase again.</p>
<p>Rob</p>`

async function findOrCreateTemplate(name: string, subject: string, bodyHtml: string): Promise<string> {
  const supabase = createClient()
  const { data: existing } = await supabase.from('outreach_templates').select('id').eq('name', name).maybeSingle()
  if (existing) return existing.id as string
  const { data: created, error } = await supabase
    .from('outreach_templates')
    .insert({ name, subject, body_html: bodyHtml })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return created.id as string
}

/** Find-or-create the site's link-outreach campaign: 15/day inside the standard
 *  Tue-Thu window, pitch step + 7-day follow-up step. */
export async function ensureLinkCampaign(site: SeoSite): Promise<string> {
  const supabase = createClient()
  if (site.outreach_campaign_id) {
    const { data } = await supabase
      .from('outreach_campaigns')
      .select('id, status')
      .eq('id', site.outreach_campaign_id)
      .maybeSingle()
    if (data) {
      // A paused/draft campaign silently queues forever — make sure it runs.
      if (data.status !== 'running') {
        await supabase.from('outreach_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', data.id)
      }
      return data.id as string
    }
  }

  const fromEmail = process.env.OUTREACH_FROM_EMAIL
  if (!fromEmail) throw new Error('OUTREACH_FROM_EMAIL is not configured')

  const pitchTemplateId = await findOrCreateTemplate(PITCH_TEMPLATE_NAME, '{{pitch_subject}}', '{{pitch_body_html}}')
  const followupTemplateId = await findOrCreateTemplate(FOLLOWUP_TEMPLATE_NAME, 'Re: {{pitch_subject}}', FOLLOWUP_BODY)

  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .insert({
      name: `Link outreach — ${site.name}`,
      status: 'running',
      from_name: process.env.OUTREACH_FROM_NAME ?? 'Rob Harvey',
      from_email: fromEmail,
      reply_to: process.env.OUTREACH_REPLY_TO ?? null,
      daily_send_cap: 15,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { error: stepsError } = await supabase.from('outreach_campaign_steps').insert([
    { campaign_id: campaign.id, step_number: 1, template_id: pitchTemplateId, delay_days: 0 },
    { campaign_id: campaign.id, step_number: 2, template_id: followupTemplateId, delay_days: 7 },
  ])
  if (stepsError) throw new Error(stepsError.message)

  await supabase.from('seo_sites').update({ outreach_campaign_id: campaign.id }).eq('id', site.id)
  return campaign.id as string
}

/** The approve click: queue the pitch into the engine. From here the engine owns
 *  sending, the follow-up and stop-on-reply. */
export async function queueApprovedPitch(targetId: string): Promise<void> {
  const supabase = createClient()
  const { data: target } = await supabase
    .from('seo_link_targets')
    .select('*')
    .eq('id', targetId)
    .single<SeoLinkTarget>()
  if (!target) throw new Error('Link target not found')
  if (!target.contact_id) throw new Error('No contact on this target')
  if (!target.pitch_subject || !target.pitch_body) throw new Error('No pitch drafted yet')
  if (target.recipient_id) throw new Error('Already queued')

  const { data: site } = await supabase
    .from('seo_sites')
    .select('*')
    .eq('id', target.site_id)
    .single<SeoSite>()
  if (!site) throw new Error('Site not found')

  const { data: article } = target.pitch_article_id
    ? await supabase
        .from('seo_articles')
        .select('title, published_url')
        .eq('id', target.pitch_article_id)
        .maybeSingle<Pick<SeoArticle, 'title' | 'published_url'>>()
    : { data: null }

  const campaignId = await ensureLinkCampaign(site)

  let theirPageHost = target.url
  try {
    theirPageHost = new URL(target.url).hostname
  } catch {
    /* keep the raw url */
  }

  const { data: recipient, error } = await supabase
    .from('outreach_recipients')
    .insert({
      campaign_id: campaignId,
      contact_id: target.contact_id,
      status: 'pending',
      next_send_at: new Date().toISOString(), // engine sends inside its own window/cap
      vars: {
        pitch_subject: target.pitch_subject,
        pitch_body_html: markdownToHtml(target.pitch_body),
        article_url: article?.published_url ?? `https://${site.domain}`,
        article_title: article?.title ?? site.name,
        their_page_host: theirPageHost,
      },
    })
    .select('id')
    .single()
  if (error) {
    // unique(campaign_id, contact_id): the contact is already in this campaign.
    if (error.code === '23505') throw new Error('This contact is already in the outreach campaign')
    throw new Error(error.message)
  }

  const { error: updateError } = await supabase
    .from('seo_link_targets')
    .update({
      recipient_id: recipient.id,
      status: 'outreach',
      outreach_at: new Date().toISOString(),
      // The engine's step 2 IS the follow-up — never also create a task for it.
      followup_created: true,
    })
    .eq('id', targetId)
  if (updateError) throw new Error(updateError.message)
}
