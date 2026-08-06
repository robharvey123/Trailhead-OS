import type { ReactNode } from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ReportData } from './data'
import type { Narrative } from './narrative'
import type { EngagementPeriodSpine } from './period-spine'
import { BRAND, COMPANY, TrailheadLockup } from '@/lib/pdf/brand'

const INK = BRAND.ink
const MUTED = BRAND.muted
const LINE = BRAND.line
const ACCENT = BRAND.blue

const styles = StyleSheet.create({
  // lineHeight must NOT live on `page` — in @react-pdf/renderer 4.3.2 it silently
  // suppresses the fixed, absolutely-positioned footer. It lives on paragraphs.
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  accentRule: { marginTop: 10, height: 2, backgroundColor: ACCENT, borderRadius: 1 },
  coverWrap: { marginTop: 130 },
  chip: { alignSelf: 'flex-start', fontSize: 8, letterSpacing: 1.5, color: ACCENT, fontFamily: 'Helvetica-Bold', borderColor: ACCENT, borderWidth: 1, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 7, marginBottom: 14, textTransform: 'uppercase' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: BRAND.navy },
  subtitle: { fontSize: 12, color: MUTED, marginBottom: 4, lineHeight: 1.5 },
  coverCompany: { position: 'absolute', bottom: 70, left: 48, right: 48, fontSize: 9, color: MUTED, lineHeight: 1.5 },
  sectionHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 20, marginBottom: 6, color: BRAND.navy },
  para: { marginBottom: 6, lineHeight: 1.5 },
  muted: { color: MUTED },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 12, color: ACCENT },
  bulletText: { flex: 1, lineHeight: 1.4 },
  metaInline: { color: MUTED },
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
function fmtShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function h(n: number): string {
  return `${n.toFixed(1)}h`
}
function taskLabel(t: { title: string; description: string | null }): string {
  return t.description || t.title
}

function KIND_LABEL(kind: string): string {
  if (kind === 'monthly_client') return 'Monthly report'
  if (kind === 'weekly_client') return 'Weekly report'
  return 'Internal report'
}

/** A bulleted list where each item is text + optional muted meta. */
function BulletList({ items }: { items: Array<{ text: string; meta?: string }> }) {
  return (
    <View>
      {items.map((it, i) => (
        <View style={styles.bullet} key={i}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            {it.text}
            {it.meta ? <Text style={styles.metaInline}> {it.meta}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  )
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  // Sections must be allowed to wrap across pages — a long list (e.g. many slipped
  // items) is taller than a page, and wrap={false} would clip it. The heading is
  // kept with its first lines via `minPresenceAhead`.
  return (
    <View>
      <Text style={styles.sectionHeading} minPresenceAhead={40}>{heading}</Text>
      {children}
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

function ReportDocument({ data, narrative, spine, kind }: { data: ReportData; narrative: Narrative; spine: EngagementPeriodSpine; kind: string }) {
  const { engagement: e } = data
  const client = e.end_client ?? e.name
  const hasContent =
    spine.completed.length || spine.in_progress.length || spine.scheduled_next.length ||
    spine.slipped.length || spine.tier1_movements.length || spine.meetings.length || spine.risks.length

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <Masthead />
        <View style={styles.coverWrap}>
          <Text style={styles.chip}>{KIND_LABEL(kind)}</Text>
          <Text style={styles.title}>{e.name}</Text>
          <Text style={styles.subtitle}>{client}</Text>
          <Text style={styles.subtitle}>{fmtDate(spine.engagement.period_start)} to {fmtDate(spine.engagement.period_end)}</Text>
          {e.billed_via ? <Text style={styles.subtitle}>Billed via {e.billed_via}</Text> : null}
        </View>
        <View style={styles.coverCompany}>
          <Text>{COMPANY.name} · {COMPANY.registered} {COMPANY.number}</Text>
          <Text>{COMPANY.email}</Text>
        </View>
        <Footer />
      </Page>

      {/* Body */}
      <Page size="A4" style={styles.page}>
        <Masthead />

        {narrative.executive_summary ? (
          <Section heading="Summary">
            <Text style={styles.para}>{narrative.executive_summary}</Text>
          </Section>
        ) : null}

        {spine.completed.length ? (
          <Section heading="Completed this period">
            <BulletList items={spine.completed.map((t) => ({ text: taskLabel(t), meta: `(completed ${fmtShort(t.completed_at)}${t.reopened ? ', reopened' : ''})` }))} />
          </Section>
        ) : null}

        {spine.in_progress.length ? (
          <Section heading="In progress">
            <BulletList items={spine.in_progress.map((t) => ({ text: taskLabel(t), meta: t.started_at ? `(started ${fmtShort(t.started_at)})` : undefined }))} />
          </Section>
        ) : null}

        {/* Hours — from the spine, per calendar month against the allowance. */}
        <Section heading="Hours">
          <View style={styles.trHead}>
            <Text style={[styles.th, { flex: 1 }]}>Month</Text>
            <Text style={[styles.th, styles.right, { width: 70 }]}>Used</Text>
            <Text style={[styles.th, styles.right, { width: 80 }]}>Allowance</Text>
            <Text style={[styles.th, styles.right, { width: 60 }]}>Over</Text>
          </View>
          {spine.hours.months.map((m, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.cell, { flex: 1 }]}>{m.month}</Text>
              <Text style={[styles.cell, styles.right, { width: 70 }]}>{h(m.used)}</Text>
              <Text style={[styles.cell, styles.right, { width: 80 }]}>{m.included != null ? h(m.included) : '—'}</Text>
              <Text style={[styles.cell, styles.right, { width: 60 }]}>{m.over ? h(m.over) : '—'}</Text>
            </View>
          ))}
          <View style={styles.tr}>
            <Text style={[styles.cell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Total in period</Text>
            <Text style={[styles.cell, styles.right, { width: 70, fontFamily: 'Helvetica-Bold' }]}>{h(spine.hours.used_in_period)}</Text>
            <Text style={[styles.cell, styles.right, { width: 80 }]} />
            <Text style={[styles.cell, styles.right, { width: 60 }]} />
          </View>
          {narrative.hours_commentary ? <Text style={[styles.para, { marginTop: 8 }]}>{narrative.hours_commentary}</Text> : null}
        </Section>

        {spine.pipeline.length ? (
          <Section heading="Pipeline">
            <BulletList items={spine.pipeline.map((p) => ({ text: p.stage, meta: `(${p.accounts.join(', ')})` }))} />
          </Section>
        ) : null}

        {spine.tier1_movements.length || spine.tier1_position.length ? (
          <Section heading="Tier 1 progress">
            {spine.tier1_movements.length ? (
              <BulletList items={spine.tier1_movements.map((m) => ({ text: `${m.account_name}: ${m.gate}`, meta: `(${fmtShort(m.date)})` }))} />
            ) : null}
            {spine.tier1_position.length ? (
              <Text style={[styles.para, styles.muted, { marginTop: 4 }]}>
                Standing: {spine.tier1_position.map((p) => `${p.account_name} ${p.gates_set}/3${p.is_complete ? ' (complete)' : ''}`).join(' · ')}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {spine.meetings.length ? (
          <Section heading="Meetings">
            <BulletList items={spine.meetings.map((m) => ({ text: m.title, meta: `(${fmtShort(m.date)}${m.attendees_summary ? ` · ${m.attendees_summary}` : ''})` }))} />
          </Section>
        ) : null}

        {spine.scheduled_next.length || narrative.outlook ? (
          <Section heading="Scheduled next period">
            {spine.scheduled_next.length ? (
              <BulletList items={spine.scheduled_next.map((t) => ({ text: taskLabel(t), meta: t.due_date ? `(due ${fmtShort(t.due_date)})` : undefined }))} />
            ) : null}
            {narrative.outlook ? <Text style={[styles.para, { marginTop: 6 }]}>{narrative.outlook}</Text> : null}
          </Section>
        ) : null}

        {spine.slipped.length ? (
          <Section heading="Slipped">
            <BulletList items={spine.slipped.map((t) => ({ text: taskLabel(t), meta: t.due_date ? `(was due ${fmtShort(t.due_date)})` : undefined }))} />
          </Section>
        ) : null}

        {spine.risks.length ? (
          <Section heading="Risks">
            <BulletList items={spine.risks.map((r) => ({ text: r.title, meta: `(${r.status})` }))} />
            {narrative.risks_commentary ? <Text style={[styles.para, { marginTop: 6 }]}>{narrative.risks_commentary}</Text> : null}
          </Section>
        ) : null}

        {!hasContent && !narrative.executive_summary ? (
          <Text style={[styles.para, styles.muted, { marginTop: 12 }]}>No client-visible activity was recorded for this period.</Text>
        ) : null}

        <Footer />
      </Page>
    </Document>
  )
}

/** Render the client report PDF to a Buffer. */
export async function renderReportPdf(data: ReportData, narrative: Narrative, spine: EngagementPeriodSpine, kind: string): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} narrative={narrative} spine={spine} kind={kind} />)
}
