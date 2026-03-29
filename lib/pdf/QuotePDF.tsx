import {
  Document,
  Page,
  Rect,
  Svg,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { calculateTotals, type QuoteWithRelations } from '@/lib/types'

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingRight: 36,
    paddingBottom: 56,
    paddingLeft: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '58%',
  },
  brandMark: {
    marginRight: 10,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  companyMeta: {
    color: '#475569',
    marginBottom: 2,
  },
  quoteDetails: {
    width: '38%',
    alignItems: 'flex-end',
  },
  quoteNumber: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
  },
  detailLine: {
    color: '#334155',
    marginBottom: 3,
  },
  badge: {
    marginTop: 6,
    border: '1 solid #bae6fd',
    backgroundColor: '#f0f9ff',
    borderRadius: 999,
    paddingTop: 3,
    paddingRight: 8,
    paddingBottom: 3,
    paddingLeft: 8,
    fontSize: 8,
    color: '#0369a1',
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: '#64748b',
    marginBottom: 8,
  },
  preparedForCard: {
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  preparedForName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 3,
  },
  projectTitle: {
    fontSize: 21,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  summaryText: {
    color: '#334155',
    lineHeight: 1.45,
  },
  phaseCard: {
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  phaseTitle: {
    width: '78%',
    fontSize: 12,
    fontWeight: 700,
  },
  durationBadge: {
    border: '1 solid #cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    paddingTop: 3,
    paddingRight: 8,
    paddingBottom: 3,
    paddingLeft: 8,
    fontSize: 8,
    color: '#334155',
  },
  phaseDescription: {
    color: '#334155',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  deliverable: {
    color: '#334155',
    marginBottom: 3,
    marginLeft: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #cbd5e1',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e2e8f0',
    paddingTop: 7,
    paddingBottom: 7,
  },
  colDescription: {
    width: '38%',
    paddingRight: 8,
  },
  colType: {
    width: '16%',
    paddingRight: 8,
  },
  colQty: {
    width: '10%',
    textAlign: 'right',
    paddingRight: 8,
  },
  colUnitPrice: {
    width: '16%',
    textAlign: 'right',
    paddingRight: 8,
  },
  colAmount: {
    width: '20%',
    textAlign: 'right',
  },
  totalsCard: {
    marginTop: 14,
    marginLeft: 'auto',
    width: 250,
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 12,
    borderBottom: '1 solid #e2e8f0',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 12,
    backgroundColor: '#e0f2fe',
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0c4a6e',
  },
  grandTotalValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0c4a6e',
  },
  bodyText: {
    color: '#334155',
    lineHeight: 1.45,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
  },
})

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

function QuoteDocument({ quote }: { quote: QuoteWithRelations }) {
  const totals = calculateTotals(quote.line_items, quote.vat_rate)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Svg width="34" height="34" viewBox="0 0 52 52">
                <Rect x="2" y="38" width="10" height="10" rx="2" fill="#0F172A" />
                <Rect x="14" y="28" width="10" height="20" rx="2" fill="#0F172A" />
                <Rect x="26" y="18" width="10" height="30" rx="2" fill="#0F172A" />
                <Rect x="38" y="4" width="10" height="44" rx="2" fill="#0EA5E9" />
              </Svg>
            </View>
            <View>
              <Text style={styles.companyName}>Trailhead Holdings Ltd</Text>
              <Text style={styles.companyMeta}>Brentwood, Essex, UK</Text>
              <Text style={styles.companyMeta}>rob@trailheadholdings.uk</Text>
            </View>
          </View>

          <View style={styles.quoteDetails}>
            <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
            <Text style={styles.detailLine}>Issue date: {quote.issue_date}</Text>
            <Text style={styles.detailLine}>Valid until: {quote.valid_until ?? 'Not set'}</Text>
            <Text style={styles.detailLine}>
              Prepared for: {quote.account?.name ?? 'No account selected'}
              {quote.contact?.name ? ` · ${quote.contact.name}` : ''}
            </Text>
            {quote.ai_generated ? <Text style={styles.badge}>AI-assisted draft</Text> : null}
          </View>
        </View>

        <View style={styles.preparedForCard}>
          <Text style={styles.sectionTitle}>Prepared For</Text>
          <Text style={styles.preparedForName}>{quote.account?.name ?? 'No account selected'}</Text>
          <Text style={styles.bodyText}>{quote.contact?.name ?? 'No contact selected'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.projectTitle}>{quote.title}</Text>
        </View>

        {quote.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.summaryText}>{quote.summary}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scope Of Work</Text>
          {quote.scope.map((phase, index) => (
            <View key={`${phase.phase}-${index}`} style={styles.phaseCard}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseTitle}>
                  {index + 1}. {phase.phase}
                </Text>
                <Text style={styles.durationBadge}>{phase.duration}</Text>
              </View>
              <Text style={styles.phaseDescription}>{phase.description}</Text>
              {phase.deliverables.map((deliverable, deliverableIndex) => (
                <Text key={`${phase.phase}-${deliverableIndex}`} style={styles.deliverable}>
                  • {deliverable}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colType}>Type</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colUnitPrice}>Unit price</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {quote.line_items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colType}>{item.type}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnitPrice}>{formatMoney(item.unit_price)}</Text>
              <Text style={styles.colAmount}>{formatMoney(item.qty * item.unit_price)}</Text>
            </View>
          ))}

          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatMoney(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>VAT ({quote.vat_rate}%)</Text>
              <Text>{formatMoney(totals.vat_amount)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatMoney(totals.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Terms</Text>
          <Text style={styles.bodyText}>{quote.payment_terms ?? '—'}</Text>
        </View>

        {quote.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes / Assumptions</Text>
            <Text style={styles.bodyText}>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          This quote is valid until {quote.valid_until ?? 'the stated expiry date'}
          {'\n'}
          Trailhead Holdings Ltd · Registered in England & Wales
        </Text>
      </Page>
    </Document>
  )
}

export async function renderQuotePdf(quote: QuoteWithRelations) {
  return renderToBuffer(<QuoteDocument quote={quote} />)
}
