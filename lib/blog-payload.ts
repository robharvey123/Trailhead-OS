import { normaliseBlogTags, parseTagList, slugifyBlogTitle } from '@/lib/blog'
import type { BlogPost, BlogPostInput } from '@/lib/types'

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function parseBlogPostPayload(
  body: Record<string, unknown>,
  existing?: BlogPost | null
): { ok: true; value: BlogPostInput } | { ok: false; error: string } {
  const title = String(body.title || '').trim()
  const bodyContent = String(body.body || '').trim()
  const rawSlug = String(body.slug || '').trim()
  const excerpt = toOptionalString(body.excerpt)
  const published = Boolean(body.published)
  const tags = Array.isArray(body.tags)
    ? normaliseBlogTags(
        body.tags.filter((tag): tag is string => typeof tag === 'string')
      )
    : typeof body.tags === 'string'
      ? parseTagList(body.tags)
      : (existing?.tags ?? [])
  const slug = slugifyBlogTitle(rawSlug || title)

  if (!title) {
    return { ok: false, error: 'title is required' }
  }

  if (!slug) {
    return { ok: false, error: 'slug is required' }
  }

  if (!bodyContent) {
    return { ok: false, error: 'body is required' }
  }

  const publishedAt = published
    ? (existing?.published_at ?? new Date().toISOString())
    : null

  return {
    ok: true,
    value: {
      title,
      slug,
      excerpt,
      body: bodyContent,
      published,
      published_at: publishedAt,
      tags,
    },
  }
}
