import Link from 'next/link'
import { headers } from 'next/headers'
import Reveal from '@/components/marketing/Reveal'
import { collectBlogTags, formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

export default async function MarketingBlogPage({
  searchParams,
}: {
  searchParams?: Promise<{ tag?: string }>
}) {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTag = resolvedSearchParams?.tag?.trim().toLowerCase() || ''
  const supabase = await createClient()
  const posts = await getPublishedBlogPosts({}, supabase).catch(() => [])
  const filteredPosts = activeTag
    ? posts.filter((post) => post.tags.includes(activeTag))
    : posts
  const tags = collectBlogTags(posts)

  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
          Thinking
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
          All blog posts
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Notes from the work: commercial strategy, product development, and the
          markets Trailhead operates in.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={buildMarketingHref('/blog', isLocalhost)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              !activeTag
                ? 'border-sky-500 bg-sky-500 text-white'
                : 'border-[var(--marketing-border)] text-slate-600 hover:border-sky-300 hover:bg-sky-50'
            }`}
          >
            All
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag}
              href={buildMarketingHref(
                `/blog?tag=${encodeURIComponent(tag)}`,
                isLocalhost
              )}
              className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] transition ${
                activeTag === tag
                  ? 'border-sky-500 bg-sky-500 text-white'
                  : 'border-[var(--marketing-border)] text-slate-600 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              {tag}
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
            >
              <p className="text-sm text-slate-500">
                {formatBlogDate(post.published_at)}
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em]">
                {post.title}
              </h2>
              <p className="mt-4 max-w-3xl text-[1rem] leading-8 text-slate-600">
                {post.excerpt}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={buildMarketingHref(`/blog/${post.slug}`, isLocalhost)}
                className="mt-6 inline-flex text-sm font-semibold text-sky-600 transition hover:text-sky-700"
              >
                Read →
              </Link>
            </article>
          ))}

          {filteredPosts.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-10 text-slate-600">
              No posts found for this tag yet.
            </div>
          ) : null}
        </div>
      </div>
    </Reveal>
  )
}
