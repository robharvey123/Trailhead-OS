import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { BRAND, COMPANY, TrailheadLockup } from '@/lib/pdf/brand'
import { gbp, longDate, noteLines } from '@/lib/quotes/format'
import { selectionTotals } from '@/lib/quotes/selection'
import type { PublicQuote, PublicQuoteAcceptance, PublicQuoteItem } from '@/lib/types'

/**
 * Client proposal PDF. Takes a PublicQuote, never a Quote, so it is
 * structurally unable to print internal fields (internal_notes, estimated
 * hours, complexity breakdown, AI drafts). The same renderer serves the public
 * download, the signed copy emailed on acceptance and the OS download.
 *
 * react-pdf 4.x notes:
 * - lineHeight must NOT sit on the page style: it silently suppresses the
 *   fixed footer (see lib/reports/pdf.tsx). It lives on paragraphs.
 * - lineHeight inside a wrap={false} block roughly doubles the line gap in
 *   this version, so those blocks (items, panels, lists) use the default.
 * - The page's paddingBottom (72) is well above the footer's height (about
 *   30 from bottom 22), so body content never runs under it.
 */

const PAD_X = 44
const PAD_TOP = 40

const s = StyleSheet.create({
  page: {
    paddingTop: PAD_TOP,
    paddingBottom: 72,
    paddingHorizontal: PAD_X,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BRAND.ink,
  },
  masthead: {
    marginTop: -PAD_TOP,
    marginHorizontal: -PAD_X,
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: PAD_X,
    backgroundColor: BRAND.navy,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mastRight: { alignItems: 'flex-end' },
  mastLabel: { fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 3, color: BRAND.paper, marginBottom: 6 },
  mastLine: { fontSize: 9, color: BRAND.coolLight, marginBottom: 2 },
  mastNumber: { fontFamily: 'Courier-Bold', fontSize: 10, color: BRAND.blueBright, marginBottom: 6 },
  accent: { marginHorizontal: -PAD_X, height: 3, backgroundColor: BRAND.blue, marginBottom: 22 },
  eyebrow: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, color: BRAND.blueInk, textTransform: 'uppercase', marginBottom: 4 },
  preparedFor: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND.navy, marginBottom: 2 },
  muted: { color: BRAND.muted },
  title: { fontFamily: 'Times-Bold', fontSize: 22, color: BRAND.navy, marginTop: 18, marginBottom: 8, lineHeight: 1.2 },
  summary: { fontSize: 10.5, color: BRAND.ink, lineHeight: 1.5, marginBottom: 6 },
  h2: { fontFamily: 'Times-Bold', fontSize: 15, color: BRAND.navy, marginTop: 22, marginBottom: 8 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BRAND.navy, paddingBottom: 5, marginBottom: 2 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: BRAND.line, paddingVertical: 6 },
  colNum: { width: 28 },
  colTitle: { flex: 1, paddingRight: 8 },
  colPrice: { width: 90, textAlign: 'right' },
  totals: { marginTop: 8, marginLeft: 'auto', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderColor: BRAND.navy, marginTop: 4, paddingTop: 6 },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: BRAND.navy },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: BRAND.navy },
  item: { borderLeftWidth: 3, borderColor: BRAND.blue, paddingLeft: 12, paddingVertical: 2, marginBottom: 16 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle: { fontFamily: 'Helvetica-Bold', fontSize: 11.5, color: BRAND.navy, flex: 1, paddingRight: 8 },
  itemPrice: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: BRAND.navy },
  itemDetail: { color: BRAND.ink, marginBottom: 4 },
  itemDuration: { fontSize: 8, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 2 },
  bullet: { width: 12, color: BRAND.blueInk },
  bulletText: { flex: 1 },
  panel: { backgroundColor: BRAND.coolLight, borderRadius: 4, padding: 12 },
  para: {},
  accept: { marginTop: 24, borderWidth: 1, borderColor: BRAND.navy, borderRadius: 4, padding: 14 },
  signRow: { flexDirection: 'row', marginTop: 18 },
  signCell: { flex: 1, marginRight: 14 },
  signLine: { borderBottomWidth: 0.75, borderColor: BRAND.ink, height: 22, marginBottom: 4 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: PAD_X,
    right: PAD_X,
    borderTopWidth: 0.5,
    borderColor: BRAND.line,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: BRAND.muted,
  },
})

function itemPrice(item: PublicQuoteItem): string {
  return item.included ? 'Included' : gbp(item.line_total)
}

function Footer({ quote }: { quote: PublicQuote }) {
  const number = quote.company.number ?? COMPANY.number
  return (
    <View style={s.footer} fixed>
      <Text>
        {quote.company.name} · Company no. {number} · Registered in England and Wales · {quote.quote_number}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function ProposalDocument({
  quote,
  selectedIds,
  acceptance,
}: {
  quote: PublicQuote
  selectedIds: string[]
  acceptance: PublicQuoteAcceptance | null
}) {
  // An accepted proposal always prints what was accepted, whatever was asked for.
  const selection = acceptance ? acceptance.selected_line_item_ids : selectedIds
  const totals = selectionTotals(quote.items, selection, quote.vat_rate)
  const counted = new Set(totals.counted_ids)
  const numberOf = new Map(quote.items.map((item, index) => [item.id, index + 1]))
  const chosen = quote.items.filter((item) => counted.has(item.id))
  const notChosen = quote.items.filter((item) => item.optional && !counted.has(item.id))
  const notes = noteLines(quote.client_notes)
  const company = quote.prepared_for.company

  return (
    <Document title={`Proposal ${quote.quote_number}`} author={quote.company.name} subject={quote.title}>
      <Page size="A4" style={s.page}>
        <View style={s.masthead}>
          <TrailheadLockup size={28} onDark />
          <View style={s.mastRight}>
            <Text style={s.mastLabel}>PROPOSAL</Text>
            <Text style={s.mastNumber}>{quote.quote_number}</Text>
            <Text style={s.mastLine}>Issued {longDate(quote.issue_date)}</Text>
            {quote.valid_until ? <Text style={s.mastLine}>Valid until {longDate(quote.valid_until)}</Text> : null}
          </View>
        </View>
        <View style={s.accent} />

        {company || quote.prepared_for.contact_first_name ? (
          <View>
            <Text style={s.eyebrow}>Prepared for</Text>
            {company ? <Text style={s.preparedFor}>{company}</Text> : null}
            {quote.prepared_for.contact_first_name ? (
              <Text style={s.muted}>For the attention of {quote.prepared_for.contact_first_name}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={s.title}>{quote.title}</Text>
        {quote.summary ? <Text style={s.summary}>{quote.summary}</Text> : null}

        <Text style={s.h2}>Your selection</Text>
        <View style={s.tableHead}>
          <Text style={[s.th, s.colNum]}>#</Text>
          <Text style={[s.th, s.colTitle]}>Feature</Text>
          <Text style={[s.th, s.colPrice]}>Price</Text>
        </View>
        {chosen.map((item) => (
          <View key={item.id} style={s.row} wrap={false}>
            <Text style={[s.colNum, s.muted]}>{String(numberOf.get(item.id) ?? 0).padStart(2, '0')}</Text>
            <Text style={s.colTitle}>{item.title}</Text>
            <Text style={s.colPrice}>{itemPrice(item)}</Text>
          </View>
        ))}
        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{gbp(totals.subtotal)}</Text>
          </View>
          {quote.vat_rate > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>VAT ({quote.vat_rate}%)</Text>
              <Text>{gbp(totals.vat_amount)}</Text>
            </View>
          ) : null}
          <View style={s.grandTotal}>
            <Text style={s.grandLabel}>Total</Text>
            <Text style={s.grandValue}>{gbp(totals.total)}</Text>
          </View>
        </View>

        {/* Detail starts on its own page so page 1 stays a one-glance summary. */}
        <View break>
          <Text style={[s.h2, { marginTop: 0 }]}>What you get</Text>
        </View>
        {chosen.map((item) => (
          <View key={item.id} style={s.item} wrap={false}>
            <View style={s.itemHead}>
              <Text style={s.itemTitle}>
                {String(numberOf.get(item.id) ?? 0).padStart(2, '0')}  {item.title}
              </Text>
              <Text style={s.itemPrice}>{itemPrice(item)}</Text>
            </View>
            {item.duration ? <Text style={s.itemDuration}>{item.duration}</Text> : null}
            {item.detail ? <Text style={s.itemDetail}>{item.detail}</Text> : null}
            {item.deliverables.map((deliverable) => (
              <View key={deliverable} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.bulletText}>{deliverable}</Text>
              </View>
            ))}
          </View>
        ))}

        {notChosen.length > 0 ? (
          <View wrap={false}>
            <Text style={s.h2}>Also available</Text>
            {notChosen.map((item) => (
              <View key={item.id} style={s.row}>
                <Text style={[s.colNum, s.muted]}>{String(numberOf.get(item.id) ?? 0).padStart(2, '0')}</Text>
                <Text style={s.colTitle}>{item.title}</Text>
                <Text style={s.colPrice}>{itemPrice(item)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {quote.payment_terms || quote.estimated_timeline ? (
          <View wrap={false}>
            <Text style={s.h2}>Payment terms</Text>
            <View style={s.panel}>
              {quote.estimated_timeline ? (
                <Text style={[s.para, { marginBottom: quote.payment_terms ? 4 : 0 }]}>Timeline: {quote.estimated_timeline}</Text>
              ) : null}
              {quote.payment_terms ? <Text style={s.para}>{quote.payment_terms}</Text> : null}
            </View>
          </View>
        ) : null}

        {notes.length > 0 ? (
          <View wrap={false}>
            <Text style={s.h2}>Good to know</Text>
            {notes.map((line, index) => (
              <View key={index} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.accept} wrap={false}>
          <Text style={s.eyebrow}>Acceptance</Text>
          {acceptance ? (
            <>
              <Text style={[s.preparedFor, { marginTop: 2 }]}>
                Accepted by {acceptance.signer_name} on {longDate(acceptance.accepted_at)}
              </Text>
              <Text style={s.muted}>
                Accepted online. Total agreed: {gbp(acceptance.total)}
                {quote.vat_rate > 0 ? ' including VAT' : ''}.
              </Text>
            </>
          ) : (
            <>
              <Text style={s.muted}>
                Accept online from your proposal link, or sign below and return a copy to {quote.company.email ?? COMPANY.email}.
              </Text>
              <View style={s.signRow}>
                <View style={s.signCell}>
                  <View style={s.signLine} />
                  <Text style={s.muted}>Accepted by</Text>
                </View>
                <View style={s.signCell}>
                  <View style={s.signLine} />
                  <Text style={s.muted}>Signature</Text>
                </View>
                <View style={[s.signCell, { marginRight: 0, flex: 0.6 }]}>
                  <View style={s.signLine} />
                  <Text style={s.muted}>Date</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Footer quote={quote} />
      </Page>
    </Document>
  )
}

export async function renderQuotePdf(input: {
  quote: PublicQuote
  selectedIds: string[]
  acceptance?: PublicQuote['acceptance']
}): Promise<Buffer> {
  return renderToBuffer(
    <ProposalDocument quote={input.quote} selectedIds={input.selectedIds} acceptance={input.acceptance ?? null} />
  )
}

export function proposalPdfFilename(quote: Pick<PublicQuote, 'quote_number'>): string {
  return `Trailhead-Proposal-${quote.quote_number.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`
}
