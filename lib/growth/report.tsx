import {
  Document,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { BRAND, COMPANY, TrailheadLockup } from '@/lib/pdf/brand'
import { createClient } from '@/lib/supabase/service'
import type { SeoGrowthScore, SeoGscDaily, SeoSite } from '@/lib/types'

/**
 * Monthly SEO client report (Growth Phase 6). Trailhead-branded @react-pdf
 * document; charts are hand-drawn with pdf Svg primitives (recharts is a DOM
 * library and can't render here — same approach as the brand logo).
 *
 * Honesty rules carried from the module: deltas only when both months have
 * data, and the AI-visibility section is labelled provisional until at least
 * four distinct weeks of runs exist.
 */

// ── Data ─────────────────────────────────────────────────────────────────────

export interface SeoReportData {
  site: SeoSite
  monthLabel: string
  score: { current: number | null; movement: number | null; summary: string | null }
  totals: {
    clicks: number
    impressions: number
    position: number | null
    prevClicks: number | null
    prevImpressions: number | null
    prevPosition: number | null
  }
  clicksByDay: Array<{ date: string; clicks: number }>
  articles: Array<{ title: string; url: string | null }>
  linksWon: Array<{ domain: string | null; url: string }>
  ai: {
    weeksOfData: number
    providers: Array<{ provider: string; runs: number; rate: number }>
    competitors: Array<{ name: string; count: number }>
  }
  nextMonth: Array<{ project: string; phase: string; start: string }>
}

function monthRange(month: string): { start: string; end: string; prevStart: string } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  const prevStart = new Date(Date.UTC(y, m - 2, 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    prevStart: prevStart.toISOString().slice(0, 10),
  }
}

function totalsFor(rows: SeoGscDaily[]): { clicks: number; impressions: number; position: number | null } {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const weighted = rows.reduce((s, r) => s + (r.position ?? 0) * r.impressions, 0)
  return {
    clicks,
    impressions,
    position: impressions > 0 ? Math.round((weighted / impressions) * 10) / 10 : null,
  }
}

export async function buildSeoReportData(siteId: string, month: string): Promise<SeoReportData> {
  const supabase = createClient()
  const { data: site } = await supabase.from('seo_sites').select('*').eq('id', siteId).single<SeoSite>()
  if (!site) throw new Error('Site not found')
  const { start, end, prevStart } = monthRange(month)

  const [dailyRes, prevDailyRes, scoresRes, articlesRes, linksRes, mentionsRes, allMentionWeeksRes] =
    await Promise.all([
      supabase.from('seo_gsc_daily').select('*').eq('site_id', siteId).gte('date', start).lt('date', end).order('date'),
      supabase.from('seo_gsc_daily').select('*').eq('site_id', siteId).gte('date', prevStart).lt('date', start),
      supabase.from('seo_growth_scores').select('*').eq('site_id', siteId).lt('score_date', end).order('score_date', { ascending: false }).limit(40),
      supabase.from('seo_articles').select('title, published_url').eq('site_id', siteId).eq('status', 'published').gte('published_at', start).lt('published_at', end),
      supabase.from('seo_link_targets').select('won_url, accounts:crm_account_id(name)').eq('site_id', siteId).eq('status', 'won').gte('won_at', start).lt('won_at', end),
      supabase.from('seo_ai_mentions').select('provider, brand_mentioned, competitors_mentioned').eq('site_id', siteId).gte('run_at', start).lt('run_at', end),
      supabase.from('seo_ai_mentions').select('run_at').eq('site_id', siteId),
    ])

  const daily = (dailyRes.data ?? []) as SeoGscDaily[]
  const prevDaily = (prevDailyRes.data ?? []) as SeoGscDaily[]
  const totals = totalsFor(daily)
  const prevTotals = prevDaily.length > 0 ? totalsFor(prevDaily) : null

  const scores = (scoresRes.data ?? []) as SeoGrowthScore[]
  const current = scores.find((s) => s.score_date < end) ?? null
  const previous = scores.find((s) => s.score_date < start) ?? null

  const byProvider = new Map<string, { runs: number; hits: number }>()
  const competitorCounts = new Map<string, number>()
  for (const m of mentionsRes.data ?? []) {
    const p = byProvider.get(m.provider as string) ?? { runs: 0, hits: 0 }
    p.runs += 1
    if (m.brand_mentioned) p.hits += 1
    byProvider.set(m.provider as string, p)
    for (const c of (m.competitors_mentioned as string[]) ?? []) {
      competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1)
    }
  }
  const weeks = new Set(
    (allMentionWeeksRes.data ?? []).map((m) => {
      const d = new Date(m.run_at as string)
      return `${d.getUTCFullYear()}-${Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * 86400_000))}`
    })
  )

  // Next month's plan: phases of cluster projects starting in the month after.
  const { data: clusters } = await supabase
    .from('seo_clusters')
    .select('project_id')
    .eq('site_id', siteId)
    .not('project_id', 'is', null)
  const projectIds = (clusters ?? []).map((c) => c.project_id as string)
  let nextMonth: SeoReportData['nextMonth'] = []
  if (projectIds.length > 0) {
    const nextEnd = monthRange(
      new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
        .toISOString()
        .slice(0, 7)
    ).end
    const { data: phases } = await supabase
      .from('project_phases')
      .select('name, start_date, projects!inner(name)')
      .in('project_id', projectIds)
      .gte('start_date', end)
      .lt('start_date', nextEnd)
      .order('start_date')
    nextMonth = (phases ?? []).map((p) => ({
      project: (p.projects as unknown as { name: string }).name,
      phase: p.name as string,
      start: p.start_date as string,
    }))
  }

  const monthDate = new Date(`${month}-01T00:00:00Z`)
  return {
    site,
    monthLabel: monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    score: {
      current: current?.score ?? null,
      movement: current && previous ? current.score - previous.score : null,
      summary: current?.breakdown.summary ?? null,
    },
    totals: {
      ...totals,
      prevClicks: prevTotals?.clicks ?? null,
      prevImpressions: prevTotals?.impressions ?? null,
      prevPosition: prevTotals?.position ?? null,
    },
    clicksByDay: daily.map((d) => ({ date: d.date, clicks: d.clicks })),
    articles: (articlesRes.data ?? []).map((a) => ({ title: a.title as string, url: a.published_url as string | null })),
    linksWon: (linksRes.data ?? []).map((l) => ({
      domain: (l.accounts as unknown as { name: string } | null)?.name ?? null,
      url: l.won_url as string,
    })),
    ai: {
      weeksOfData: weeks.size,
      providers: [...byProvider.entries()].map(([provider, { runs, hits }]) => ({
        provider,
        runs,
        rate: runs > 0 ? Math.round((hits / runs) * 100) : 0,
      })),
      competitors: [...competitorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    },
    nextMonth,
  }
}

// ── Document ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 46, fontFamily: 'Helvetica', fontSize: 9.5, color: BRAND.ink },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  docTitle: { marginTop: 14, fontSize: 19, fontFamily: 'Helvetica-Bold', color: BRAND.navy },
  docSub: { marginTop: 3, fontSize: 10, color: BRAND.muted },
  rule: { marginTop: 12, height: 2, backgroundColor: BRAND.blue },
  section: { marginTop: 16 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND.navy, marginBottom: 6 },
  muted: { color: BRAND.muted },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreBig: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: BRAND.navy },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BRAND.line, paddingVertical: 4 },
  trHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BRAND.navy, paddingVertical: 4 },
  th: { fontFamily: 'Helvetica-Bold', color: BRAND.navy },
  cellMetric: { width: '34%' },
  cell: { width: '22%', textAlign: 'right' },
  li: { marginBottom: 3 },
  footer: {
    position: 'absolute', bottom: 24, left: 46, right: 46,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: BRAND.line, paddingTop: 6,
    fontSize: 7.5, color: BRAND.muted,
  },
})

function delta(now: number | null, prev: number | null, invert = false): string {
  if (now === null || prev === null) return '—'
  const d = Math.round((now - prev) * 10) / 10
  if (d === 0) return '±0'
  const improving = invert ? d < 0 : d > 0
  return `${d > 0 ? '+' : ''}${d}${improving ? ' ▲' : ' ▼'}`
}

function ClicksChart({ data }: { data: Array<{ date: string; clicks: number }> }) {
  if (data.length < 2) return null
  const width = 500
  const height = 80
  const max = Math.max(...data.map((d) => d.clicks), 1)
  const barWidth = width / data.length
  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const h = Math.max((d.clicks / max) * (height - 4), d.clicks > 0 ? 2 : 0.5)
        return (
          <Rect
            key={d.date}
            x={i * barWidth + 0.5}
            y={height - h}
            width={Math.max(barWidth - 1, 0.8)}
            height={h}
            fill={BRAND.blue}
          />
        )
      })}
    </Svg>
  )
}

function SeoReportDocument({ data }: { data: SeoReportData }) {
  const t = data.totals
  return (
    <Document title={`SEO report — ${data.site.name} — ${data.monthLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <TrailheadLockup />
          <View>
            <Text style={{ fontSize: 9, color: BRAND.muted, textAlign: 'right' }}>{data.monthLabel}</Text>
          </View>
        </View>
        <Text style={styles.docTitle}>SEO performance report</Text>
        <Text style={styles.docSub}>
          {data.site.name} · {data.site.domain}
        </Text>
        <View style={styles.rule} />

        <View style={styles.section}>
          <Text style={styles.h2}>Growth Score</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreBig}>{data.score.current ?? '—'}</Text>
            <Text style={styles.muted}>/ 100</Text>
            {data.score.movement !== null ? (
              <Text>{data.score.movement >= 0 ? `+${data.score.movement}` : data.score.movement} vs last month</Text>
            ) : (
              <Text style={styles.muted}>no prior month to compare yet</Text>
            )}
          </View>
          {data.score.summary ? <Text style={[styles.muted, { marginTop: 4 }]}>{data.score.summary}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Search performance</Text>
          <View style={styles.trHead}>
            <Text style={[styles.cellMetric, styles.th]}>Metric</Text>
            <Text style={[styles.cell, styles.th]}>This month</Text>
            <Text style={[styles.cell, styles.th]}>Last month</Text>
            <Text style={[styles.cell, styles.th]}>Change</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.cellMetric}>Clicks</Text>
            <Text style={styles.cell}>{t.clicks.toLocaleString('en-GB')}</Text>
            <Text style={styles.cell}>{t.prevClicks?.toLocaleString('en-GB') ?? '—'}</Text>
            <Text style={styles.cell}>{delta(t.clicks, t.prevClicks)}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.cellMetric}>Impressions</Text>
            <Text style={styles.cell}>{t.impressions.toLocaleString('en-GB')}</Text>
            <Text style={styles.cell}>{t.prevImpressions?.toLocaleString('en-GB') ?? '—'}</Text>
            <Text style={styles.cell}>{delta(t.impressions, t.prevImpressions)}</Text>
          </View>
          <View style={styles.tr}>
            <Text style={styles.cellMetric}>Average position</Text>
            <Text style={styles.cell}>{t.position ?? '—'}</Text>
            <Text style={styles.cell}>{t.prevPosition ?? '—'}</Text>
            <Text style={styles.cell}>{delta(t.position, t.prevPosition, true)}</Text>
          </View>
          {data.clicksByDay.length > 1 ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.muted, { marginBottom: 4 }]}>Daily clicks</Text>
              <ClicksChart data={data.clicksByDay} />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Content published</Text>
          {data.articles.length === 0 ? (
            <Text style={styles.muted}>No articles published this month.</Text>
          ) : (
            data.articles.map((a, i) => (
              <Text key={i} style={styles.li}>
                • {a.title}
                {a.url ? <Text style={styles.muted}>  {a.url}</Text> : null}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Links won</Text>
          {data.linksWon.length === 0 ? (
            <Text style={styles.muted}>No new referring links recorded this month.</Text>
          ) : (
            data.linksWon.map((l, i) => (
              <Text key={i} style={styles.li}>
                • {l.domain ?? 'New referring domain'} <Text style={styles.muted}>{l.url}</Text>
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>AI search visibility</Text>
          {data.ai.providers.length === 0 ? (
            <Text style={styles.muted}>AI answer tracking had no runs this month.</Text>
          ) : (
            <>
              {data.ai.weeksOfData < 4 ? (
                <Text style={[styles.muted, { marginBottom: 4 }]}>
                  Provisional — {data.ai.weeksOfData} week{data.ai.weeksOfData === 1 ? '' : 's'} of data;
                  AI answers vary run to run, so treat trends as indicative until four weeks exist.
                </Text>
              ) : null}
              {data.ai.providers.map((p) => (
                <Text key={p.provider} style={styles.li}>
                  • {p.provider}: recommended in {p.rate}% of {p.runs} answers
                </Text>
              ))}
              {data.ai.competitors.length > 0 ? (
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  Most-named competitors: {data.ai.competitors.map((c) => `${c.name} (${c.count})`).join(', ')}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Next month</Text>
          {data.nextMonth.length === 0 ? (
            <Text style={styles.muted}>
              Continue the content and outreach programme; priorities set at the monthly review.
            </Text>
          ) : (
            data.nextMonth.map((p, i) => (
              <Text key={i} style={styles.li}>
                • {p.project} — {p.phase} (from {new Date(p.start).toLocaleDateString('en-GB')})
              </Text>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {COMPANY.name} · {COMPANY.registered} · {COMPANY.email}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function renderSeoReportPdf(siteId: string, month: string): Promise<Buffer> {
  const data = await buildSeoReportData(siteId, month)
  return renderToBuffer(<SeoReportDocument data={data} />)
}
