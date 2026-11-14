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
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Article' }

// The Regenerate action runs draftArticle inline, and a full article is the
// longest model call in the OS — the same reason /api/cron/growth-draft raises
// its own ceiling. Server actions inherit this segment's limit.
export const maxDuration = 300

function publishLabel(cmsType: string): string {
  if (cmsType === 'wordpress') return 'Create WordPress draft'
  if (cmsType === 'internal') return 'Draft to marketing blog'
  return 'Open publish PR'
}

function formatDay(iso: string | null): string {
  if (!iso) return 'an unknown date'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

  // Voice drift: this copy was written to a brand_voice that has since been
  // replaced, so it reads in the old voice. Not a blocker — it is Rob's call —
  // but publishing it should be a deliberate choice rather than a default.
  const voiceChangedAt = site.brand_voice_updated_at
  const voiceIsStale = Boolean(
    voiceChangedAt && article.drafted_at && new Date(article.drafted_at) < new Date(voiceChangedAt)
  )
  const voiceStaleWarning = voiceIsStale
    ? `This was drafted on ${formatDay(article.drafted_at)}, before the brand voice changed on ${formatDay(voiceChangedAt)} — it is written in the old voice. Regenerate first if you want the new one.`
    : null

  return (
    <div className="os-narrow space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={`/growth/${site.id}/articles`}
            className="hover:text-[color:var(--accent-strong)]"
          >
            {site.name} · Articles
          </Link>
        }
        title={article.title}
        description={
          <>
            {article.status}
            {article.word_count ? ` · ${article.word_count.toLocaleString('en-GB')} words` : ''}
            {article.model_used ? ` · ${article.model_used}` : ''}
            {article.token_cost !== null ? ` · ~$${article.token_cost.toFixed(2)} tokens` : ''}
          </>
        }
        actions={
          <>
            {article.status === 'review' ? (
              <form action={approveArticleAction.bind(null, site.id, article.id)}>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Approve article
                </button>
              </form>
            ) : null}
            {article.status === 'approved' ? (
              <form action={publishArticleAction.bind(null, site.id, article.id)}>
                {voiceStaleWarning ? (
                  <ConfirmPendingButton
                    confirmLabel="Publish the old-voice draft"
                    pendingLabel="Publishing…"
                    warning={voiceStaleWarning}
                    variant="primary"
                  >
                    {publishLabel(site.cms_type)}
                  </ConfirmPendingButton>
                ) : (
                  <PendingButton variant="primary" pendingLabel="Publishing…">
                    {publishLabel(site.cms_type)}
                  </PendingButton>
                )}
              </form>
            ) : null}
            {article.status === 'publishing' && article.publish_ref?.startsWith('http') ? (
              <>
                <form action={mergeArticlePrAction.bind(null, site.id, article.id)}>
                  {/* Waits for the build and refuses on failure — see mergePublishPr. */}
                  <PendingButton variant="primary" pendingLabel="Checking build, then merging…">
                    Merge PR → go live
                  </PendingButton>
                </form>
                <form action={verifyPublishAction.bind(null, site.id, article.id)}>
                  <PendingButton pendingLabel="Checking…">Check status</PendingButton>
                </form>
              </>
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
                  className="btn btn-ghost"
                >
                  Retry draft
                </button>
              </form>
            ) : null}
          </>
        }
      />

      {voiceStaleWarning && article.status !== 'published' ? (
        <div className="rounded-card border border-[var(--amber)]/40 bg-[var(--amber-dim)] px-4 py-3 text-sm text-[var(--amber-strong)]">
          {voiceStaleWarning}
        </div>
      ) : null}
      {resolved?.error ? (
        <div className="rounded-card border border-[var(--red)]/40 bg-[var(--red-dim)] px-4 py-3 text-sm text-[var(--red-strong)]">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-card border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}
      {article.error ? (
        <div className="rounded-card border border-[var(--red)]/40 bg-[var(--red-dim)] px-4 py-3 text-sm text-[var(--red-strong)]">
          Draft failed: {article.error}
        </div>
      ) : null}
      {article.publish_error && article.status !== 'published' ? (
        <div className="rounded-card border border-[var(--red)]/40 bg-[var(--red-dim)] px-4 py-3 text-sm text-[var(--red-strong)]">
          Publish failed: {article.publish_error}
          {article.publish_branch ? (
            <span className="mt-1 block text-[var(--red-strong)]">
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
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          Drafting in progress — the drafting job runs every five minutes and you&apos;ll get a
          push when it&apos;s ready.
        </div>
      ) : null}

      {article.schema_jsonld ? (
        <details className="os-card p-6">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
            Schema JSON-LD
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-card bg-[var(--surface-2)] p-4 text-xs text-[color:var(--text-2)]">
            {JSON.stringify(article.schema_jsonld, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
