import type { BlogPost } from '@/lib/types'

export const blogMarkdownClassName = [
  'marketing-prose',
  'max-w-none',
  'text-[var(--marketing-text)]',
].join(' ')

export function slugifyBlogTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseTagList(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

export function normaliseBlogTags(tags: string[]) {
  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  )
}

export function formatBlogDate(value: string | null | undefined) {
  if (!value) {
    return 'Draft'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function collectBlogTags(posts: BlogPost[]) {
  return Array.from(new Set(posts.flatMap((post) => post.tags))).sort(
    (left, right) => left.localeCompare(right)
  )
}
