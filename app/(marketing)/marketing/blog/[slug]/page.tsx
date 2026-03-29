import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import ReactMarkdown from 'react-markdown'
import Reveal from '@/components/marketing/Reveal'
import { blogMarkdownClassName, formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPostBySlug } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

export default async function MarketingBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const post = await getPublishedBlogPostBySlug(slug, supabase).catch(
    () => null
  )

  if (!post || !post.published) {
    notFound()
  }

  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <article className="mx-auto max-w-[720px]">
        <Link
          href={buildMarketingHref('/blog', isLocalhost)}
          className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
        >
          ← All posts
        </Link>

        <p className="mt-8 text-sm text-slate-500">
          {formatBlogDate(post.published_at)}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
          {post.title}
        </h1>
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
        <div className={`mt-10 ${blogMarkdownClassName}`}>
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>
      </article>
    </Reveal>
  )
}
