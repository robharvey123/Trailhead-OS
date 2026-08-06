import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ReportData } from './data'
import type { Narrative } from './narrative'
import { BRAND, COMPANY, TrailheadLockup } from '@/lib/pdf/brand'

const INK = BRAND.ink
const MUTED = BRAND.muted
const LINE = BRAND.line
const ACCENT = BRAND.blue

const styles = StyleSheet.create({
  // lineHeight must NOT live on `page` — in @react-pdf/renderer 4.3.2 it silently
  // suppresses the fixed, absolutely-positioned footer. It lives on paragraphs.
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  // Blue accent rule under the header lockup — the brand mark.
  accentRule: { marginTop: 10, height: 2, backgroundColor: ACCENT, borderRadius: 1 },
  coverWrap: { marginTop: 130 },
  chip: { alignSelf: 'flex-start', fontSize: 8, letterSpacing: 1.5, color: ACCENT, fontFamily: 'Helvetica-Bold', borderColor: ACCENT, borderWidth: 1, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 7, marginBottom: 14, textTransform: 'uppercase' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: BRAND.navy },
  subtitle: { fontSize: 12, color: MUTED, marginBottom: 4, lineHeight: 1.5 },
  coverCompany: { position: 'absolute', bottom: 70, left: 48, right: 48, fontSize: 9, color: MUTED, lineHeight: 1.5 },
  sectionHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 22, marginBottom: 8, color: BRAND.navy },
  para: { marginBottom: 6, lineHeight: 1.5 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, color: ACCENT },
  bulletText: { flex: 1, lineHeight: 1.5 },
  workTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4 },
  trHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE, paddingBottom: 4, marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: LINE, paddingVertical: 4 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  cell: { fontSize: 9 },
  right: { textAlign: 'right' },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: MUTED, borderTopWidth: 1, borderColor: LINE, paddingTop: 6 },
})

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
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

function Masthead() {
  return (
    <View>
      <TrailheadLockup size={28} />
      <View style={styles.accentRule} />
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>{COMPANY.name} · {COMPANY.registered} {COMPANY.number} · Confidential</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function ReportDocument({ data, narrative, kind }: { data: ReportData; narrative: Narrative; kind: string }) {
  const { engagement: e, period, hours_summary: hs } = data
  const client = e.end_client ?? e.name

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <Masthead />
        <View style={styles.coverWrap}>
          <Text style={styles.chip}>{KIND_LABEL(kind)}</Text>
          <Text style={styles.title}>{e.name}</Text>
          <Text style={styles.subtitle}>{client}</Text>
          <Text style={styles.subtitle}>
            {fmtDate(period.start)} to {fmtDate(period.end)}
          </Text>
          {e.billed_via ? <Text style={styles.subtitle}>Billed via {e.billed_via}</Text> : null}
        </View>
        <View style={styles.coverCompany}>
          <Text>{COMPANY.name} · {COMPANY.registered} {COMPANY.number}</Text>
          <Text>{COMPANY.email}</Text>
        </View>
        <Footer />
      </Page>

      {/* Narrative + hours */}
      <Page size="A4" style={styles.page}>
        <Masthead />

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

        {/* Hours are aggregate only — no per-person breakdown (contributor
            identities) and no monetary value. A client artefact carries time,
            not billing. */}
        <Text style={styles.sectionHeading}>Hours</Text>
        <View style={styles.trHead}>
          <Text style={[styles.th, { flex: 1 }]}>Measure</Text>
          <Text style={[styles.th, styles.right, { width: 90 }]}>Value</Text>
        </View>
        <View style={styles.tr}>
          <Text style={[styles.cell, { flex: 1 }]}>Total hours in period</Text>
          <Text style={[styles.cell, styles.right, { width: 90, fontFamily: 'Helvetica-Bold' }]}>{h(hs.total)}</Text>
        </View>
        {e.included_hours != null ? (
          <>
            <View style={styles.tr}>
              <Text style={[styles.cell, { flex: 1 }]}>Hours included (monthly allowance)</Text>
              <Text style={[styles.cell, styles.right, { width: 90 }]}>{h(e.included_hours)}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={[styles.cell, { flex: 1 }]}>Allowance used</Text>
              <Text style={[styles.cell, styles.right, { width: 90 }]}>{data.totals.vs_retainer_pct}%</Text>
            </View>
          </>
        ) : null}
        {narrative.hours_commentary ? <Text style={[styles.para, { marginTop: 8 }]}>{narrative.hours_commentary}</Text> : null}

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
