import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { blogMarkdownClassName } from '@/lib/blog'
import { getSeoArticleById, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { ConfirmPendingButton } from '@/components/growth/ConfirmPendingButton'
import { PendingButton } from '@/components/growth/PendingButton'
import {
  approveArticleAction,
  mergeArticlePrAction,
  publishArticleAction,
  regenerateArticleAction,
  retryDraftAction,
  verifyPublishAction,
} from '../../../actions'

// The Regenerate action runs draftArticle inline, and a full article is the
// longest model call in the OS — the same reason /api/cron/growth-draft raises
// its own ceiling. Server actions inherit this segment's limit.
export const maxDuration = 300

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
            <PendingButton variant="primary" pendingLabel="Publishing…">
              {site.cms_type === 'wordpress'
                ? 'Create WordPress draft'
                : site.cms_type === 'internal'
                  ? 'Draft to marketing blog'
                  : 'Open publish PR'}
            </PendingButton>
          </form>
        ) : null}
        {article.status === 'publishing' && article.publish_ref?.startsWith('http') ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={mergeArticlePrAction.bind(null, site.id, article.id)}>
              {/* Waits for the build and refuses on failure — see mergePublishPr. */}
              <PendingButton variant="primary" pendingLabel="Checking build, then merging…">
                Merge PR → go live
              </PendingButton>
            </form>
            <form action={verifyPublishAction.bind(null, site.id, article.id)}>
              <PendingButton pendingLabel="Checking…">Check status</PendingButton>
            </form>
          </div>
        ) : null}
        {article.body_mdx && (article.status === 'review' || article.status === 'approved') ? (
          <form action={regenerateArticleAction.bind(null, site.id, article.id)}>
            <ConfirmPendingButton
              confirmLabel="Overwrite the draft"
              pendingLabel="Re-drafting…"
              warning={`This replaces the current copy, meta description and schema for "${article.title}" with a fresh draft from the brief. The old version is not kept.${
                article.status === 'approved' ? ' The article goes back to review, so it will need approving again.' : ''
              }`}
            >
              Regenerate
            </ConfirmPendingButton>
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
      {article.publish_error && article.status !== 'published' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Publish failed: {article.publish_error}
          {article.publish_branch ? (
            <span className="mt-1 block text-red-600">
              Publishing again resumes the branch{' '}
              <code className="font-mono">{article.publish_branch}</code> rather than opening a
              second one.
            </span>
          ) : null}
        </div>
      ) : null}

      {article.status === 'publishing' ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Publishing</h2>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Not live yet. It counts as published once the pull request is merged{' '}
            <em>and</em>{' '}
            {article.published_url ? (
              <a
                href={article.published_url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[color:var(--accent-strong)] underline underline-offset-2"
              >
                {article.published_url}
              </a>
            ) : (
              'its URL'
            )}{' '}
            returns 200. Checked every five minutes.
            {article.publish_ref?.startsWith('http') ? (
              <>
                <br />
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
            ) : null}
          </p>
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
