import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import Reveal from '@/components/marketing/Reveal'
import { collectBlogTags, formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Blog, Notes on NGP, FMCG and Building Products',
  description:
    'Working notes from Trailhead Holdings on the nicotine and reduced-risk category, FMCG go to market, and building software for real businesses.',
  path: '/blog',
})

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
    <div>
      <section className="pt-10 pb-8 md:pt-16 md:pb-10">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-data text-[var(--ink-3)]">BAY 04</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Notes</p>
          </div>
          <div className="min-w-0">
            <h1 className="plan-display rack max-w-[12ch]">All blog posts</h1>
            <p className="plan-lede mt-7">
              Notes from the work: commercial strategy, product development, and
              the markets Trailhead operates in.
            </p>
          </div>
        </div>
      </section>

      <Reveal className="rail">
        <div className="bay py-8 md:py-12">
          <div className="bay-code">
            <p className="plan-note text-[var(--ink-3)]">Filter</p>
            <p className="plan-data mt-1 text-[var(--ink-3)]">
              {filteredPosts.length} OF {posts.length}
            </p>
          </div>

          <div className="min-w-0">
            <nav aria-label="Filter posts by tag" className="flex flex-wrap gap-2">
              <Link
                href={buildMarketingHref('/blog', isLocalhost)}
                aria-current={!activeTag ? 'true' : undefined}
                className={`plan-label border px-3 py-2 transition-colors ${
                  !activeTag
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--plan)]'
                    : 'border-[var(--hair)] bg-[var(--card)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
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
                  aria-current={activeTag === tag ? 'true' : undefined}
                  className={`plan-label border px-3 py-2 transition-colors ${
                    activeTag === tag
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--plan)]'
                      : 'border-[var(--hair)] bg-[var(--card)] text-[var(--ink-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
                  }`}
                >
                  {tag}
                </Link>
              ))}
            </nav>

            <div className="mt-8 border-t border-[var(--ink)]">
              {filteredPosts.map((post) => (
                <article key={post.id} className="border-b border-[var(--hair)]">
                  <Link
                    href={buildMarketingHref(`/blog/${post.slug}`, isLocalhost)}
                    className="group grid gap-x-8 gap-y-2 py-6 transition-colors hover:bg-[var(--card)] md:grid-cols-[9rem_minmax(0,1fr)]"
                  >
                    <div>
                      <p className="plan-data text-[var(--ink-3)]">
                        {formatBlogDate(post.published_at)}
                      </p>
                      <p className="plan-data mt-2 text-[var(--ink-3)]">
                        {post.tags.join(' · ').toUpperCase()}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <h2
                        className="text-[clamp(1.375rem,2.4vw,1.875rem)] leading-tight font-bold"
                        style={{ fontStretch: '84%', letterSpacing: '-0.015em' }}
                      >
                        {post.title}
                      </h2>
                      <p className="plan-body mt-3 plan-body-sm">
                        {post.excerpt}
                      </p>
                      <p className="plan-label mt-4 inline-flex items-center gap-2 text-[var(--flash)]">
                        Read
                        <PlanIcon
                          name="right"
                          size={13}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </p>
                    </div>
                  </Link>
                </article>
              ))}

              {filteredPosts.length === 0 ? (
                <div className="border-b border-[var(--hair)] py-10">
                  <p className="plan-h3">Nothing filed under this tag yet.</p>
                  <p className="plan-body mt-3">
                    Clear the filter to see everything published so far.
                  </p>
                  <Link
                    href={buildMarketingHref('/blog', isLocalhost)}
                    className="flash-ghost mt-6"
                  >
                    Show all posts
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
