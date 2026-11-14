import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoLinkTargets, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { PendingButton } from '@/components/growth/PendingButton'
import {
  approvePitchAction,
  draftPitchAction,
  draftPitchesBatchAction,
  findContactAction,
  findContactsBatchAction,
  importProspectsAction,
  markLinkLostAction,
  markLinkOutreachAction,
  markLinkWonAction,
} from '../../actions'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Link building' }

const STATUS_STYLE: Record<string, string> = {
  identified: 'border-[color:var(--border)] text-[color:var(--text-2)]',
  researching: 'border-[var(--amber)]/40 bg-[var(--amber-dim)] text-[var(--amber-strong)]',
  outreach: 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  won: 'border-[var(--emerald)] bg-[var(--emerald-dim)] text-[var(--emerald-strong)]',
  lost: 'border-[color:var(--border)] text-[color:var(--text-3)]',
}

const INPUT_CLASS = 'os-input px-3 py-2 text-sm'

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
      <PageHeader
        eyebrow={
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        }
        title="Link building"
        description={
          <>
            Prospects are real CRM accounts (record type “link prospect”) — email history and notes
            live on the account. {won > 0 ? `${won} link${won === 1 ? '' : 's'} won so far.` : ''}
          </>
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

      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Mine a competitor</h2>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Pulls their referring domains from DataForSEO (one per domain), filters out pages they
          own, and files the rest as CRM prospects with a suggested angle. Then run the automated
          outreach steps below.
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
          <PendingButton variant="primary" pendingLabel="Mining backlinks… (10-20s)">
            Import prospects
          </PendingButton>
        </form>
      </div>

      {targets.length > 0 ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Automated outreach</h2>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            Find contacts (scrape + extract, batches of 8) → draft personalised pitches (batches of
            5) → review each pitch below and approve. Approved pitches go through the outreach
            engine: sent Tue-Thu inside the send window, one follow-up at 7 days, stops the moment
            they reply, unsubscribe handled.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={findContactsBatchAction.bind(null, site.id)}>
              <PendingButton variant="primary" pendingLabel="Searching sites… (~1 min)">
                Find contacts
              </PendingButton>
            </form>
            <form action={draftPitchesBatchAction.bind(null, site.id)}>
              <PendingButton pendingLabel="Writing pitches… (~2 min)">
                Draft pitches
              </PendingButton>
            </form>
          </div>
        </div>
      ) : null}

      {targets.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
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
                  {target.contact_id ? (
                    <p className="mt-1 text-sm text-[var(--emerald-strong)]">
                      Contact found{target.contact_note ? ` — ${target.contact_note}` : ''}
                    </p>
                  ) : target.contact_search_at ? (
                    <p className="mt-1 text-sm text-[color:var(--text-3)]">
                      No contact found{target.contact_note ? ` — ${target.contact_note}` : ''}
                    </p>
                  ) : null}
                  {target.pitch_subject && target.pitch_body ? (
                    <details className="mt-2 rounded-card border border-[color:var(--border)] px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-[color:var(--text)]">
                        Pitch: {target.pitch_subject}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">
                        {target.pitch_body}
                      </p>
                    </details>
                  ) : null}
                  {target.won_url ? (
                    <p className="mt-1 break-all text-sm text-[var(--emerald-strong)]">Won: {target.won_url}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-pill border px-3 py-1 text-xs font-medium ${STATUS_STYLE[target.status] ?? ''}`}
                >
                  {target.status}
                </span>
              </div>
              {target.status === 'identified' || target.status === 'researching' || target.status === 'outreach' ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {target.status !== 'outreach' && !target.contact_search_at ? (
                    <form action={findContactAction.bind(null, site.id, target.id)}>
                      <PendingButton className="btn-sm" pendingLabel="Searching…">
                        Find contact
                      </PendingButton>
                    </form>
                  ) : null}
                  {target.status !== 'outreach' && target.contact_id ? (
                    <form action={draftPitchAction.bind(null, site.id, target.id)}>
                      <PendingButton className="btn-sm" pendingLabel="Writing…">
                        {target.pitch_generated_at ? 'Redraft pitch' : 'Draft pitch'}
                      </PendingButton>
                    </form>
                  ) : null}
                  {target.status !== 'outreach' && target.contact_id && target.pitch_subject ? (
                    <form action={approvePitchAction.bind(null, site.id, target.id)}>
                      <PendingButton variant="primary" className="btn-sm" pendingLabel="Queueing…">
                        Approve &amp; queue send
                      </PendingButton>
                    </form>
                  ) : null}
                  {target.status !== 'outreach' ? (
                    <form action={markLinkOutreachAction.bind(null, site.id, target.id)}>
                      <PendingButton className="btn-sm" pendingLabel="Marking…">
                        Sent manually
                      </PendingButton>
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
                      className="btn btn-ghost btn-sm"
                    >
                      Won
                    </button>
                  </form>
                  <form action={markLinkLostAction.bind(null, site.id, target.id)}>
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm"
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
