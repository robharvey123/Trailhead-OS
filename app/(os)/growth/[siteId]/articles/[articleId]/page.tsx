import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { blogMarkdownClassName } from '@/lib/blog'
import { getSeoArticleById, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { approveArticleAction, publishArticleAction, retryDraftAction } from '../../../actions'

export default async function GrowthArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; articleId: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId, articleId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [site, article] = await Promise.all([
    getSeoSiteById(siteId, supabase),
    getSeoArticleById(articleId, supabase),
  ])
  if (!site || !article || article.site_id !== site.id) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link
              href={`/growth/${site.id}/articles`}
              className="hover:text-[color:var(--accent-strong)]"
            >
              {site.name} · Articles
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">{article.title}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {article.status}
            {article.word_count ? ` · ${article.word_count.toLocaleString('en-GB')} words` : ''}
            {article.model_used ? ` · ${article.model_used}` : ''}
            {article.token_cost !== null ? ` · ~$${article.token_cost.toFixed(2)} tokens` : ''}
          </p>
        </div>
        {article.status === 'review' ? (
          <form action={approveArticleAction.bind(null, site.id, article.id)}>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Approve article
            </button>
          </form>
        ) : null}
        {article.status === 'approved' ? (
          <form action={publishArticleAction.bind(null, site.id, article.id)}>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              {site.cms_type === 'wordpress'
                ? 'Create WordPress draft'
                : site.cms_type === 'internal'
                  ? 'Draft to marketing blog'
                  : 'Open publish PR'}
            </button>
          </form>
        ) : null}
        {article.status === 'drafting' && article.error ? (
          <form action={retryDraftAction.bind(null, site.id, article.id)}>
            <button
              type="submit"
              className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
            >
              Retry draft
            </button>
          </form>
        ) : null}
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}
      {article.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Draft failed: {article.error}
        </div>
      ) : null}

      {article.status === 'published' ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Published</h2>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {article.published_url ? (
              <>
                Live URL:{' '}
                <a
                  href={article.published_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[color:var(--accent-strong)] underline underline-offset-2"
                >
                  {article.published_url}
                </a>
              </>
            ) : null}
            {article.publish_ref ? (
              <>
                <br />
                {article.publish_ref.startsWith('http') ? (
                  <>
                    Pull request:{' '}
                    <a
                      href={article.publish_ref}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-[color:var(--accent-strong)] underline underline-offset-2"
                    >
                      {article.publish_ref}
                    </a>
                  </>
                ) : article.publish_ref.startsWith('blog:') ? (
                  <>Marketing blog draft — review and publish it from the /blog editor</>
                ) : (
                  <>WordPress post #{article.publish_ref} (draft — publish from WP admin)</>
                )}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {article.meta_description ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Meta description</h2>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">{article.meta_description}</p>
        </div>
      ) : null}

      {article.body_mdx ? (
        <div className="os-card p-6 sm:p-8">
          <article className={blogMarkdownClassName}>
            <ReactMarkdown>{article.body_mdx}</ReactMarkdown>
          </article>
        </div>
      ) : !article.error ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          Drafting in progress — the drafting job runs every five minutes and you&apos;ll get a
          push when it&apos;s ready.
        </div>
      ) : null}

      {article.schema_jsonld ? (
        <details className="os-card p-6">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
            Schema JSON-LD
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-[var(--surface-2)] p-4 text-xs text-[color:var(--text-2)]">
            {JSON.stringify(article.schema_jsonld, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
