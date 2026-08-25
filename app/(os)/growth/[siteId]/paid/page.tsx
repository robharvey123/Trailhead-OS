import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPaidData, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { PendingButton } from '@/components/growth/PendingButton'
import { googleAdsConfigured } from '@/lib/growth/ads-google'
import { metaAdsConfigured } from '@/lib/growth/ads-meta'
import {
  channelTable,
  coverGapKeywords,
  fatiguedCreatives,
  groupWastedTerms,
  handoffOpportunities,
  minedSearchTerms,
  pacing,
  paidOnOwnedKeywords,
  trackingHealth,
  trailingTrend,
  wastedSearchTerms,
} from '@/lib/growth/paid-loops'
import { linkAdsAccountAction, syncAdsNowAction } from '../../actions'

/** E6: /paid — Search (Google), Social (Meta), Blended. */

function money(n: number | null | undefined, currency?: string | null): string {
  if (n === null || n === undefined) return '—'
  return `${currency ? `${currency} ` : ''}${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

export default async function GrowthPaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string; tab?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()
  const tab = resolved?.tab === 'social' || resolved?.tab === 'blended' ? resolved.tab : 'search'

  const data = await getPaidData(siteId, supabase)
  const googleAccounts = data.accounts.filter((a) => a.platform === 'google')
  const metaAccounts = data.accounts.filter((a) => a.platform === 'meta')
  const currency = data.accounts[0]?.currency ?? null

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)

  const [mined, owned, handoffs, cover, wasted, fatigue, pace, tracking, blended, trend] = await Promise.all([
    minedSearchTerms(siteId).catch(() => []),
    paidOnOwnedKeywords(siteId).catch(() => []),
    handoffOpportunities(siteId).catch(() => []),
    coverGapKeywords(siteId).catch(() => []),
    wastedSearchTerms(siteId).catch(() => []),
    fatiguedCreatives(siteId).catch(() => []),
    pacing(siteId, site.monthly_ads_budget).catch(() => []),
    trackingHealth(siteId).catch(() => []),
    channelTable(siteId, monthStart, nextMonth).catch(() => null),
    trailingTrend(siteId, 6).catch(() => []),
  ])
  const wastedGroups = groupWastedTerms(wasted)
  const inputClass =
    'rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

  const tabs = [
    { key: 'search', label: `Search · Google${googleAccounts.length ? '' : ' (not linked)'}` },
    { key: 'social', label: `Social · Meta${metaAccounts.length ? '' : ' (not linked)'}` },
    { key: 'blended', label: 'Blended' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
              {site.name}
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">Paid media</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Organic and paid answer the same question with different data. The search terms report is the only first-party, commercially weighted keyword source there is.
          </p>
        </div>
        {data.accounts.length > 0 ? (
          <form action={syncAdsNowAction.bind(null, site.id)}>
            <PendingButton pendingLabel="Syncing ad platforms…">Sync now</PendingButton>
          </form>
        ) : null}
      </div>

      {resolved?.error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resolved.error}</div> : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{resolved.notice}</div>
      ) : null}

      {tracking.length > 0 ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Conversion tracking check.</strong>{' '}
          {tracking.map((t) => `${t.campaign} (${t.platform}) spent ${money(t.spend14d, currency)} in 14 days with zero conversions`).join(' · ')}. Almost always a broken tag, not bad performance.
        </div>
      ) : null}

      {/* Pacing */}
      {pace.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {pace.map((p) => (
            <div key={p.platform} className="os-card p-5">
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">{p.platform === 'google' ? 'Google Ads' : 'Meta'} · month to date</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--text)]">{money(p.spendMtd, currency)}</p>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">
                projects to {money(p.projectedMonthEnd, currency)}
                {p.target ? ` vs ${money(p.target, currency)} target` : ' — set a monthly media budget in settings for pacing alerts'}
                {p.variancePct !== null ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${Math.abs(p.variancePct) >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {p.variancePct > 0 ? '+' : ''}
                    {p.variancePct}%
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/growth/${site.id}/paid?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 ${tab === t.key ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]' : 'border-[color:var(--border)] text-[color:var(--text-2)]'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Account linking */}
      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Linked accounts</h2>
        {data.accounts.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--text-3)]">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-2)]">
            {data.accounts.map((a) => (
              <li key={a.id}>
                {a.platform === 'google' ? 'Google Ads' : 'Meta'} · {a.name ?? a.external_id} ({a.external_id})
                {a.last_synced_at ? ` · synced ${new Date(a.last_synced_at).toLocaleString('en-GB')}` : ' · never synced'}
                {a.last_error ? <span className="ml-2 text-red-600">{a.last_error.slice(0, 160)}</span> : null}
              </li>
            ))}
          </ul>
        )}
        <form action={linkAdsAccountAction.bind(null, site.id)} className="mt-4 flex flex-wrap gap-2">
          <select name="platform" className={inputClass} defaultValue="google">
            <option value="google">Google Ads</option>
            <option value="meta">Meta</option>
          </select>
          <input name="external_id" required placeholder="Customer id (123-456-7890) or ad account id" className={`${inputClass} grow`} />
          <input name="name" placeholder="Label (optional)" className={inputClass} />
          <PendingButton variant="primary" pendingLabel="Linking…">
            Link account
          </PendingButton>
        </form>
        <p className="mt-2 text-xs text-[color:var(--text-3)]">
          Google Ads: {googleAdsConfigured() ? 'developer token configured' : 'GOOGLE_ADS_DEVELOPER_TOKEN not set — apply for API access against the MCC, then reconnect Google to grant the adwords scope'}.{' '}
          Meta: {metaAdsConfigured() ? 'system user token configured' : 'META_SYSTEM_USER_TOKEN not set — needs a Business Manager system user with ads_read'}.
        </p>
      </div>

      {tab === 'search' ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Search term mining — proven demand, no organic page ({mined.length})</h2>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">Converting search terms with no page in Search Console and no cluster. Pushed to the keyword list nightly as source “google_ads”.</p>
              {mined.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing yet — needs a synced Google Ads account with conversions.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {mined.slice(0, 15).map((t) => (
                    <li key={t.search_term} className="flex justify-between gap-3">
                      <span className="text-[color:var(--text)]">{t.search_term}</span>
                      <span className="shrink-0 tabular-nums text-[color:var(--text-3)]">
                        {t.conversions} conv · {money(t.conversion_value, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Paying for what you already own ({owned.length})</h2>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">Organic 1-3 and still buying the click. Some is defensible; decide with the position in view.</p>
              {owned.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--text-3)]">None found.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {owned.slice(0, 12).map((k) => (
                    <li key={`${k.keyword}-${k.match_type}`} className="flex justify-between gap-3">
                      <span className="text-[color:var(--text)]">
                        {k.keyword} <span className="text-xs text-[color:var(--text-3)]">organic #{k.organic_position}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[color:var(--text-3)]">
                        {money(k.cost, currency)} · {k.clicks} clicks · {k.conversions} conv
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Handoff model — where SEO makes the spend optional ({handoffs.length})</h2>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">
                Converting on paid, organic at 4-20. Optional spend = modelled organic clicks at position 3 × your CPC (CTR curve, capped at current spend). Payback assumes ~600 of content work per page.
              </p>
              {handoffs.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--text-3)]">None found.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                        <th className="py-2 pr-3 font-medium">Keyword</th>
                        <th className="py-2 pr-3 text-right font-medium">Organic</th>
                        <th className="py-2 pr-3 text-right font-medium">CPA</th>
                        <th className="py-2 pr-3 text-right font-medium">Optional/mo</th>
                        <th className="py-2 text-right font-medium">Payback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handoffs.slice(0, 15).map((h) => (
                        <tr key={h.keyword} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="py-2 pr-3 text-[color:var(--text)]">{h.keyword}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{h.organic_position}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(h.cpa, currency)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(h.optional_spend_per_month, currency)}</td>
                          <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">{h.payback_months ?? '—'} mo</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Cover the gap while it closes ({cover.length})</h2>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">Commercial-intent keywords at organic 11-20 with no paid coverage. Bid while the refresh lands, then step down.</p>
              {cover.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--text-3)]">None found (needs measured intent from the enrichment run).</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {cover.slice(0, 15).map((k) => (
                    <li key={k.keyword} className="flex justify-between gap-3">
                      <span className="text-[color:var(--text)]">{k.keyword}</span>
                      <span className="shrink-0 tabular-nums text-[color:var(--text-3)]">
                        #{k.organic_position} · {k.gsc_impressions.toLocaleString('en-GB')} impr · CPC {k.cpc ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Wasted spend — {wasted.length} terms, {money(wasted.reduce((s, t) => s + t.cost, 0), currency)} over 60 days with no conversions</h2>
            {wasted.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing over the spend threshold.</p>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <ul className="space-y-1.5 text-sm">
                  {wastedGroups.slice(0, 12).map((g) => (
                    <li key={g.pattern}>
                      <span className="font-medium text-[color:var(--text)]">{g.pattern}</span>{' '}
                      <span className="text-[color:var(--text-3)]">
                        {money(g.cost, currency)} · {g.terms.slice(0, 4).join(', ')}
                        {g.terms.length > 4 ? '…' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Negatives, ready to paste</p>
                  <textarea readOnly rows={10} value={wasted.map((t) => t.search_term).join('\n')} className={`mt-1 w-full ${inputClass} font-mono text-xs`} />
                </div>
              </div>
            )}
          </div>

          {data.keywords.length > 0 ? (
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Keywords by cost (top 30) · Quality Score</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                      <th className="py-2 pr-3 font-medium">Keyword</th>
                      <th className="py-2 pr-3 font-medium">Match</th>
                      <th className="py-2 pr-3 text-right font-medium">Cost</th>
                      <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                      <th className="py-2 pr-3 text-right font-medium">Conv</th>
                      <th className="py-2 pr-3 text-right font-medium">QS</th>
                      <th className="py-2 pr-3 font-medium">Landing page exp.</th>
                      <th className="py-2 text-right font-medium">Impr. share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.slice(0, 30).map((k) => (
                      <tr key={k.id} className="border-b border-[color:var(--border)] last:border-0">
                        <td className="py-2 pr-3 text-[color:var(--text)]">{k.keyword}</td>
                        <td className="py-2 pr-3 text-xs text-[color:var(--text-3)]">{k.match_type?.toLowerCase()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(k.cost, currency)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{k.clicks}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{k.conversions}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{k.quality_score ?? '—'}</td>
                        <td className={`py-2 pr-3 text-xs ${k.qs_landing_page === 'BELOW_AVERAGE' ? 'text-red-600' : 'text-[color:var(--text-3)]'}`}>{k.qs_landing_page?.toLowerCase().replace('_', ' ') ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">{k.impression_share !== null ? `${Math.round(Number(k.impression_share) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'social' ? (
        <>
          {fatigue.length > 0 ? (
            <div className="os-card p-6">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Creative fatigue ({fatigue.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {fatigue.map((f) => (
                  <li key={f.creative.id}>
                    <span className="font-medium text-[color:var(--text)]">{f.creative.name ?? f.creative.external_id}</span>{' '}
                    <span className="text-[color:var(--text-3)]">
                      frequency {f.creative.frequency} · CTR down {f.ctrDropPct}% vs first week
                      {f.replacement ? ` · model on “${f.replacement.headline ?? f.replacement.name}”` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Creatives · 28 days ({data.creatives.length})</h2>
            <p className="mt-1 text-xs text-[color:var(--text-3)]">The top decile by CTR feeds brief generation as “angles proven to earn attention from this audience”.</p>
            {data.creatives.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--text-3)]">No creative data yet — link a Meta ad account.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                      <th className="py-2 pr-3 font-medium">Creative</th>
                      <th className="py-2 pr-3 font-medium">Headline / text</th>
                      <th className="py-2 pr-3 text-right font-medium">Spend</th>
                      <th className="py-2 pr-3 text-right font-medium">Reach</th>
                      <th className="py-2 pr-3 text-right font-medium">Freq.</th>
                      <th className="py-2 pr-3 text-right font-medium">CTR</th>
                      <th className="py-2 text-right font-medium">Conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.creatives.slice(0, 40).map((c) => (
                      <tr key={c.id} className="border-b border-[color:var(--border)] last:border-0">
                        <td className="py-2 pr-3 text-[color:var(--text)]">
                          {c.name ?? c.external_id} <span className="text-xs text-[color:var(--text-3)]">{c.format ?? ''}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-[color:var(--text-2)]">
                          <span className="font-medium">{c.headline ?? ''}</span> {c.primary_text?.slice(0, 90) ?? ''}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(c.spend, currency)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{c.reach.toLocaleString('en-GB')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{c.frequency ?? '—'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{c.ctr !== null ? `${c.ctr}%` : '—'}</td>
                        <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">{c.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === 'blended' ? (
        <div className="space-y-4">
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Channels · month to date</h2>
            {!blended ? (
              <p className="mt-3 text-sm text-[color:var(--text-3)]">No data.</p>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                        <th className="py-2 pr-3 font-medium">Channel</th>
                        <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                        <th className="py-2 pr-3 text-right font-medium">Impressions</th>
                        <th className="py-2 pr-3 text-right font-medium">Spend</th>
                        <th className="py-2 pr-3 text-right font-medium">Conversions</th>
                        <th className="py-2 text-right font-medium">CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blended.rows.map((r) => (
                        <tr key={r.channel} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="py-2 pr-3 text-[color:var(--text)]">{r.channel}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{r.clicks.toLocaleString('en-GB')}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{r.impressions.toLocaleString('en-GB')}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(r.spend, currency)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{r.conversions ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">{money(r.cpa, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Equivalent media value of organic</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--text)]">{money(blended.equivalentMediaValue, currency)}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-3)]">What this month&apos;s organic clicks would have cost at your Ads CPCs (DataForSEO CPC where never bought). A model, not revenue.</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Blended CAC (paid channels)</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--text)]">{money(blended.blendedCac, currency)}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-3)]">Google and Meta attribute differently and can double count; treat as directional.</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Trailing 6 months</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                    <th className="py-2 pr-3 font-medium">Month</th>
                    <th className="py-2 pr-3 text-right font-medium">Paid spend</th>
                    <th className="py-2 pr-3 text-right font-medium">Organic clicks</th>
                    <th className="py-2 text-right font-medium">Blended CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="py-2 pr-3 text-[color:var(--text)]">{t.month}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{money(t.spend, currency)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{t.organicClicks.toLocaleString('en-GB')}</td>
                      <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">{money(t.blendedCac, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
