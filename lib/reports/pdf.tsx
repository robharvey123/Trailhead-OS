import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ReportData } from './data'
import type { Narrative } from './narrative'

// Restrained consulting-deliverable palette. No logo image is loaded (the brand
// kit isn't bundled) — a typographic wordmark is used so the render never fails
// on a missing asset.
const INK = '#1A1A1A'
const MUTED = '#6B7280'
const LINE = '#E5E7EB'
const ACCENT = '#0F766E' // teal

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: INK, fontFamily: 'Helvetica', lineHeight: 1.5 },
  wordmark: { fontSize: 11, letterSpacing: 2, fontFamily: 'Helvetica-Bold', color: INK },
  coverWrap: { marginTop: 220 },
  chip: { alignSelf: 'flex-start', fontSize: 8, letterSpacing: 1.5, color: ACCENT, fontFamily: 'Helvetica-Bold', borderColor: ACCENT, borderWidth: 1, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 7, marginBottom: 14, textTransform: 'uppercase' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  subtitle: { fontSize: 12, color: MUTED, marginBottom: 4 },
  sectionHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 22, marginBottom: 8, color: INK },
  para: { marginBottom: 6 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, color: ACCENT },
  bulletText: { flex: 1 },
  workTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 },
  table: { marginTop: 6, borderTopWidth: 1, borderColor: LINE },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE, paddingVertical: 4 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  cell: { fontSize: 9 },
  right: { textAlign: 'right' },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: MUTED, borderTopWidth: 1, borderColor: LINE, paddingTop: 6 },
})

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}
function h(n: number): string {
  return `${n.toFixed(1)}h`
}

function KIND_LABEL(kind: string): string {
  if (kind === 'monthly_client') return 'Monthly report'
  if (kind === 'weekly_client') return 'Weekly report'
  return 'Internal report'
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View style={styles.bullet} key={i}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Trailhead Holdings Ltd · Confidential</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function ReportDocument({ data, narrative, kind }: { data: ReportData; narrative: Narrative; kind: string }) {
  const { engagement: e, period, hours_summary: hs } = data
  const showValue = e.is_billable
  const client = e.end_client ?? e.name

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.wordmark}>TRAILHEAD HOLDINGS</Text>
        <View style={styles.coverWrap}>
          <Text style={styles.chip}>{KIND_LABEL(kind)}</Text>
          <Text style={styles.title}>{e.name}</Text>
          <Text style={styles.subtitle}>{client}</Text>
          <Text style={styles.subtitle}>
            {fmtDate(period.start)} to {fmtDate(period.end)}
          </Text>
          {e.billed_via ? <Text style={styles.subtitle}>Billed via {e.billed_via}</Text> : null}
        </View>
        <Footer />
      </Page>

      {/* Narrative + hours */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.wordmark}>TRAILHEAD HOLDINGS</Text>

        {narrative.executive_summary ? (
          <>
            <Text style={styles.sectionHeading}>Summary</Text>
            <Text style={styles.para}>{narrative.executive_summary}</Text>
          </>
        ) : null}

        {narrative.highlights.length ? (
          <>
            <Text style={styles.sectionHeading}>Highlights</Text>
            <Bullets items={narrative.highlights} />
          </>
        ) : null}

        {narrative.work_completed.length ? (
          <>
            <Text style={styles.sectionHeading}>Work completed</Text>
            {narrative.work_completed.map((s, i) => (
              <View key={i} wrap={false}>
                <Text style={styles.workTitle}>{s.section_title}</Text>
                <Bullets items={s.items} />
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionHeading}>Hours</Text>
        <View style={styles.tr}>
          <Text style={[styles.th, { flex: 1 }]}>Person</Text>
          <Text style={[styles.th, styles.right, { width: 80 }]}>Hours</Text>
        </View>
        {hs.by_person.map((p, i) => (
          <View style={styles.tr} key={i}>
            <Text style={[styles.cell, { flex: 1 }]}>{p.name}</Text>
            <Text style={[styles.cell, styles.right, { width: 80 }]}>{h(p.hours)}</Text>
          </View>
        ))}
        <View style={styles.tr}>
          <Text style={[styles.cell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Total</Text>
          <Text style={[styles.cell, styles.right, { width: 80, fontFamily: 'Helvetica-Bold' }]}>{h(hs.total)}</Text>
        </View>
        <Text style={[styles.para, { marginTop: 8, color: MUTED }]}>
          {hs.billable.toFixed(1)}h billable
          {showValue ? ` · ${money(data.totals.value_gbp, e.currency)}` : ''}
          {e.included_hours != null ? ` · ${hs.total.toFixed(1)} of ${e.included_hours} retainer hours (${data.totals.vs_retainer_pct}%)` : ''}
        </Text>
        {narrative.hours_commentary ? <Text style={styles.para}>{narrative.hours_commentary}</Text> : null}

        {narrative.next_period.length ? (
          <>
            <Text style={styles.sectionHeading}>Next period</Text>
            <Bullets items={narrative.next_period} />
          </>
        ) : null}

        {narrative.risks_or_blockers.length ? (
          <>
            <Text style={styles.sectionHeading}>Risks and blockers</Text>
            <Bullets items={narrative.risks_or_blockers} />
          </>
        ) : null}

        <Footer />
      </Page>
    </Document>
  )
}

/** Render the client report PDF to a Buffer. */
export async function renderReportPdf(data: ReportData, narrative: Narrative, kind: string): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} narrative={narrative} kind={kind} />)
}
