/**
 * Best-effort page fetch for the Growth module — title, meta description and
 * heading outline of a live URL. Used by brief generation (competitor
 * headings) and the refresh worksheet (what the page has now). Hard timeout,
 * never throws: a page that cannot be read returns null.
 */

export interface PageOutline {
  url: string
  title: string | null
  meta_description: string | null
  h1: string[]
  /** Ordered "H2: text" / "H3: text" strings. */
  headings: string[]
  /** Rough visible word count — a thin-content signal, not a precise measure. */
  word_count: number
  /** Internal links (same host) found in the body, absolute. */
  internal_links: string[]
  fetched_at: string
}

const TIMEOUT_MS = 8000
const MAX_HTML = 800_000
const MAX_HEADINGS = 40

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function clean(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim()
}

export async function fetchPageOutline(url: string): Promise<PageOutline | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrailheadGrowth/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = (await res.text()).slice(0, MAX_HTML)

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const metaMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)

    const h1: string[] = []
    const headings: string[] = []
    for (const match of html.matchAll(/<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const text = clean(match[2])
      if (!text) continue
      if (match[1] === '1') h1.push(text)
      else headings.push(`H${match[1]}: ${text}`)
      if (headings.length >= MAX_HEADINGS) break
    }

    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
    const visible = clean(
      body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    )
    const wordCount = visible.split(/\s+/).filter(Boolean).length

    let host = ''
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      /* keep empty */
    }
    const internal = new Set<string>()
    for (const match of body.matchAll(/<a[^>]+href=["']([^"'#?]+)[^"']*["']/gi)) {
      const href = match[1]
      try {
        const abs = new URL(href, url)
        if (abs.hostname.replace(/^www\./, '') === host) internal.add(abs.origin + abs.pathname)
      } catch {
        /* ignore malformed */
      }
      if (internal.size >= 200) break
    }

    return {
      url,
      title: titleMatch ? clean(titleMatch[1]) : null,
      meta_description: metaMatch ? decodeEntities(metaMatch[1]).trim() : null,
      h1,
      headings,
      word_count: wordCount,
      internal_links: [...internal],
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Legacy shape used by brief generation: H1/H2 headings only. */
export async function fetchHeadings(url: string): Promise<{ url: string; headings: string[] } | null> {
  const outline = await fetchPageOutline(url)
  if (!outline) return null
  const headings = [
    ...outline.h1.map((h) => `H1: ${h}`),
    ...outline.headings.filter((h) => h.startsWith('H2:')),
  ].slice(0, 20)
  return headings.length > 0 ? { url, headings } : null
}
