import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoLinkTargets, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import {
  importProspectsAction,
  markLinkLostAction,
  markLinkOutreachAction,
  markLinkWonAction,
} from '../../actions'

const STATUS_STYLE: Record<string, string> = {
  identified: 'border-[color:var(--border)] text-[color:var(--text-2)]',
  researching: 'border-amber-300 bg-amber-50 text-amber-700',
  outreach: 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  won: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  lost: 'border-[color:var(--border)] text-[color:var(--text-3)]',
}

const INPUT_CLASS =
  'rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

export default async function GrowthLinksPage({
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
  const targets = await getSeoLinkTargets(siteId, supabase)
  const won = targets.filter((t) => t.status === 'won').length

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        </p>
        <h1 className="mt-2 os-page-title">Link building</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Prospects are real CRM accounts (record type “link prospect”) — email history and notes
          live on the account. {won > 0 ? `${won} link${won === 1 ? '' : 's'} won so far.` : ''}
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

      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Mine a competitor</h2>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Pulls their referring domains from DataForSEO (one per domain), filters out pages they
          own, and files the rest as CRM prospects with a suggested angle. Finding the right
          contact is manual research — no contacts are auto-created.
        </p>
        <form
          action={importProspectsAction.bind(null, site.id)}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            name="competitor"
            required
            placeholder="joblogic.com"
            className={`min-w-56 grow ${INPUT_CLASS}`}
          />
          <button
            type="submit"
            className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Import prospects
          </button>
        </form>
      </div>

      {targets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No link targets yet — mine a competitor above.
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
            <div key={target.id} className="os-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[color:var(--text)]">
                    {target.account_name ?? 'Unlinked prospect'}{' '}
                    <span className="text-sm font-normal text-[color:var(--text-3)]">
                      · tier {target.tier ?? '—'} · DR {target.domain_authority ?? '—'}
                    </span>
                  </p>
                  <a
                    href={target.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block break-all text-sm text-[color:var(--text-2)] underline decoration-[color:var(--border)] underline-offset-2 hover:text-[color:var(--accent-strong)]"
                  >
                    {target.url}
                  </a>
                  {target.angle ? (
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">{target.angle}</p>
                  ) : null}
                  {target.won_url ? (
                    <p className="mt-1 break-all text-sm text-emerald-700">Won: {target.won_url}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[target.status] ?? ''}`}
                >
                  {target.status}
                </span>
              </div>
              {target.status === 'identified' || target.status === 'researching' || target.status === 'outreach' ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {target.status !== 'outreach' ? (
                    <form action={markLinkOutreachAction.bind(null, site.id, target.id)}>
                      <button
                        type="submit"
                        className="rounded-2xl border border-[color:var(--border)] px-3 py-1.5 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
                      >
                        Mark outreach sent
                      </button>
                    </form>
                  ) : null}
                  <form
                    action={markLinkWonAction.bind(null, site.id, target.id)}
                    className="flex items-center gap-2"
                  >
                    <input
                      name="won_url"
                      placeholder="Live URL of the won link"
                      className={`min-w-52 ${INPUT_CLASS}`}
                    />
                    <button
                      type="submit"
                      className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:border-emerald-400"
                    >
                      Won
                    </button>
                  </form>
                  <form action={markLinkLostAction.bind(null, site.id, target.id)}>
                    <button
                      type="submit"
                      className="rounded-2xl border border-[color:var(--border)] px-3 py-1.5 text-sm text-[color:var(--text-3)] transition hover:border-red-300 hover:text-red-600"
                    >
                      Lost
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
