import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoBriefById, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { approveBriefAction, rejectBriefAction } from '../../../actions'
import PageHeader from '@/components/ui/PageHeader'

interface BriefOutline {
  angle?: string
  sections?: Array<{ heading: string; notes: string }>
  faq?: Array<{ question: string }>
}

export default async function GrowthBriefDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; briefId: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId, briefId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [site, brief] = await Promise.all([
    getSeoSiteById(siteId, supabase),
    getSeoBriefById(briefId, supabase),
  ])
  if (!site || !brief || brief.site_id !== site.id) notFound()

  const outline = (brief.outline ?? {}) as BriefOutline
  const internalLinks = (brief.internal_links ?? []) as Array<{ anchor: string; url: string }>

  return (
    <div className="os-narrow space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={`/growth/${site.id}/briefs`}
            className="hover:text-[color:var(--accent-strong)]"
          >
            {site.name} · Briefs
          </Link>
        }
        title={brief.title}
        description={
          <>
            {brief.target_keyword} · {brief.intent ?? 'no intent'} · target{' '}
            {brief.word_target ?? '—'} words · /{brief.slug}
          </>
        }
        actions={
          brief.status === 'proposed' ? (
            <>
              <form action={approveBriefAction.bind(null, site.id, brief.id)}>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Approve &amp; queue draft
                </button>
              </form>
              <form action={rejectBriefAction.bind(null, site.id, brief.id)}>
                <button
                  type="submit"
                  className="btn btn-ghost"
                >
                  Reject
                </button>
              </form>
            </>
          ) : (
            <span className="rounded-pill border border-[color:var(--border)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]">
              {brief.status}
            </span>
          )
        }
      />

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

      {outline.angle ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">
            The angle nobody else has
          </h2>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">{outline.angle}</p>
        </div>
      ) : null}

      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Outline</h2>
        <ol className="mt-3 space-y-3">
          {(outline.sections ?? []).map((section, i) => (
            <li key={i}>
              <p className="font-medium text-[color:var(--text)]">{section.heading}</p>
              <p className="mt-0.5 text-sm text-[color:var(--text-2)]">{section.notes}</p>
            </li>
          ))}
        </ol>
        {(outline.faq ?? []).length > 0 ? (
          <>
            <h3 className="os-label mt-5">
              FAQ (from People Also Ask)
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--text-2)]">
              {(outline.faq ?? []).map((f, i) => (
                <li key={i}>{f.question}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Secondary keywords</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brief.secondary_keywords.length === 0 ? (
              <p className="text-sm text-[color:var(--text-3)]">None</p>
            ) : (
              brief.secondary_keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-pill border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--text-2)]"
                >
                  {k}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Internal links</h2>
          {internalLinks.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">
              None — no published articles to link to yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {internalLinks.map((l, i) => (
                <li key={i} className="text-[color:var(--text-2)]">
                  “{l.anchor}” → <span className="break-all text-[color:var(--text-3)]">{l.url}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
