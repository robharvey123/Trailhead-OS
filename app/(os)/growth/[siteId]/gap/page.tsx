import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoCompetitors, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { PendingButton } from '@/components/growth/PendingButton'
import GapTable from '@/components/os/growth/GapTable'
import { gapKeywords, suggestCompetitors } from '@/lib/growth/competitors'
import { addCompetitorAction, pullCompetitorAction, toggleCompetitorAction } from '../../actions'

/** B2: "what do they rank for that we do not". */
export default async function GrowthGapPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string; labs?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()

  const [competitors, gap, suggestions] = await Promise.all([
    getSeoCompetitors(siteId, supabase),
    gapKeywords(siteId).catch(() => []),
    suggestCompetitors(site, resolved?.labs === '1').catch(() => []),
  ])
  const inputClass =
    'rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        </p>
        <h1 className="mt-2 os-page-title">Competitor gap</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Keywords where a tracked competitor ranks in the top 20 and {site.name} does not (or ranks below 20). A keyword three competitors own is a stronger signal than one.
        </p>
      </div>

      {resolved?.error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resolved.error}</div> : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{resolved.notice}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="os-card p-6 xl:col-span-2">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Tracked competitors</h2>
          {competitors.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">None yet. Add one below or pick from the suggestions.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[color:var(--border)]">
              {competitors.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <span className={c.tracked ? 'text-[color:var(--text)]' : 'text-[color:var(--text-3)] line-through'}>{c.domain}</span>
                    <span className="ml-2 text-xs text-[color:var(--text-3)]">
                      {c.added_by} · {c.keyword_count ?? 0} keywords{c.last_pulled_at ? ` · pulled ${new Date(c.last_pulled_at).toLocaleDateString('en-GB')}` : ' · not pulled'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <form action={pullCompetitorAction.bind(null, site.id, c.domain)}>
                      <PendingButton pendingLabel="Pulling…">Re-pull</PendingButton>
                    </form>
                    <form action={toggleCompetitorAction.bind(null, site.id, c.id, !c.tracked)}>
                      <PendingButton pendingLabel="Saving…">{c.tracked ? 'Untrack' : 'Track'}</PendingButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form action={addCompetitorAction.bind(null, site.id)} className="mt-4 flex flex-wrap gap-2">
            <input name="domain" required placeholder="competitor.co.uk" className={`${inputClass} grow`} />
            <input type="hidden" name="added_by" value="manual" />
            <PendingButton variant="primary" pendingLabel="Pulling ranked keywords (one Labs call)…">
              Add and pull keywords
            </PendingButton>
          </form>
          <p className="mt-2 text-xs text-[color:var(--text-3)]">Each pull is one DataForSEO Labs call (up to 1,000 keywords, a few pence). Re-pull monthly.</p>
        </div>

        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Suggested competitors</h2>
          <p className="mt-1 text-xs text-[color:var(--text-3)]">
            From the domains that keep appearing in your tracked keywords&apos; top 10{resolved?.labs === '1' ? ' and DataForSEO Labs' : ''}.
          </p>
          {suggestions.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">No suggestions yet — SERP snapshots feed this.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {suggestions.slice(0, 10).map((s) => (
                <li key={s.domain} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-[color:var(--text-2)]">
                    {s.domain} <span className="text-xs text-[color:var(--text-3)]">· {s.source} · {s.strength}</span>
                  </span>
                  <form action={addCompetitorAction.bind(null, site.id)}>
                    <input type="hidden" name="domain" value={s.domain} />
                    <input type="hidden" name="added_by" value={s.source} />
                    <PendingButton pendingLabel="Pulling…">Add</PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {resolved?.labs !== '1' ? (
            <Link href={`/growth/${site.id}/gap?labs=1`} className="mt-3 inline-block text-xs text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2">
              Also ask DataForSEO Labs (one call)
            </Link>
          ) : null}
        </div>
      </div>

      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Gap keywords ({gap.length.toLocaleString('en-GB')})</h2>
        {gap.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing to show — track a competitor and pull its keywords.</p>
        ) : (
          <div className="mt-4">
            <GapTable siteId={site.id} rows={gap} />
          </div>
        )}
      </div>
    </div>
  )
}
