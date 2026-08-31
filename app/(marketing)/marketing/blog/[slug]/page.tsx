import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import ReactMarkdown from 'react-markdown'
import PlanIcon from '@/components/marketing/PlanIcon'
import Reveal from '@/components/marketing/Reveal'
import { blogMarkdownClassName, formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPostBySlug, getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata, absoluteUrl } from '@/lib/seo'
import { BlogPostingJsonLd } from '@/components/JsonLd'

export async function generateStaticParams() {
  try {
    const posts = await getPublishedBlogPosts()
    return posts.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = await getPublishedBlogPostBySlug(slug)
    if (!post) return {}
    return buildMetadata({
      title: post.title,
      description: post.excerpt ?? post.title,
      path: `/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at ?? post.published_at ?? undefined,
      authors: ['Rob Harvey'],
      keywords: post.tags,
    })
  } catch {
    return {}
  }
}

export default async function MarketingBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const post = await getPublishedBlogPostBySlug(slug, supabase).catch(() => null)

  if (!post || !post.published) {
    notFound()
  }

  return (
    <Reveal>
      <article className="pt-8 pb-16 md:pt-12 md:pb-20">
        <div className="bay">
          <BlogPostingJsonLd
            title={post.title}
            description={post.excerpt ?? post.title}
            url={absoluteUrl(`/blog/${post.slug}`)}
            datePublished={post.published_at ?? post.created_at}
            dateModified={post.updated_at ?? post.published_at ?? post.created_at}
            authorName="Rob Harvey"
          />

          {/* The filing block sits in the gutter beside the piece, the way a
              drawing's revision data sits beside the drawing. */}
          <div className="bay-code bay-code-lead">
            <Link
              href={buildMarketingHref('/blog', isLocalhost)}
              className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
            >
              <PlanIcon name="left" size={13} />
              All posts
            </Link>
            <div className="mt-6 border-t border-[var(--hair)] pt-3">
              <p className="plan-data text-[var(--ink-3)]">FILED</p>
              <p className="plan-data mt-1 text-[var(--ink-2)]">
                {formatBlogDate(post.published_at)}
              </p>
              {post.tags.length ? (
                <>
                  <p className="plan-data mt-4 text-[var(--ink-3)]">TAGS</p>
                  <p className="plan-data mt-1 text-[var(--ink-2)]">
                    {post.tags.join(' · ').toUpperCase()}
                  </p>
                </>
              ) : null}
              <p className="plan-data mt-4 text-[var(--ink-3)]">BY</p>
              <p className="plan-data mt-1 text-[var(--ink-2)]">ROB HARVEY</p>
            </div>
          </div>

          <div className="min-w-0">
            <h1
              className="max-w-[20ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[0.98] font-bold"
              style={{ fontStretch: '80%', letterSpacing: '-0.02em' }}
            >
              {post.title}
            </h1>

            {post.excerpt ? (
              <p className="plan-lede mt-6 border-b border-[var(--hair)] pb-8">
                {post.excerpt}
              </p>
            ) : null}

            <div className={`mt-8 ${blogMarkdownClassName}`}>
              <ReactMarkdown>{post.body}</ReactMarkdown>
            </div>

            <div className="ticket mt-14 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                WRITTEN BY THE OPERATOR, NOT A CONTENT TEAM
              </p>
              <div className="ticket-rule">
                <Link
                  href={buildMarketingHref('/contact', isLocalhost)}
                  className="flash"
                >
                  Start a conversation
                  <PlanIcon name="right" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  )
}
