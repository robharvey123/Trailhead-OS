import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoBriefs, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'

const STATUS_STYLE: Record<string, string> = {
  proposed: 'border-amber-300 bg-amber-50 text-amber-700',
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-600',
  drafted: 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
}

export default async function GrowthBriefsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()
  const briefs = await getSeoBriefs(siteId, supabase)

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        </p>
        <h1 className="mt-2 os-page-title">Article briefs</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Approving a brief queues the draft; the drafting job picks it up within five minutes.
        </p>
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

      {briefs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No briefs yet — generate one from a cluster on the{' '}
          <Link href={`/growth/${site.id}/clusters`} className="underline underline-offset-2">
            clusters page
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {briefs.map((brief) => (
            <Link
              key={brief.id}
              href={`/growth/${site.id}/briefs/${brief.id}`}
              className="os-card block p-5 transition hover:border-[color:var(--accent)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[color:var(--text)]">{brief.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-2)]">
                    {brief.target_keyword ?? 'no target keyword'} ·{' '}
                    {brief.word_target ?? '—'} words ·{' '}
                    {new Date(brief.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[brief.status] ?? ''}`}
                >
                  {brief.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
