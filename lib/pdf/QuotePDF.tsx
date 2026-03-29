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
    paddingBottom: 60,
    paddingLeft: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brand: {
    flexDirection: 'row',
    maxWidth: '56%',
  },
  brandMark: {
    marginRight: 10,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: '#475569',
    marginBottom: 2,
  },
  rightMeta: {
    width: '38%',
    alignItems: 'flex-end',
  },
  quoteNumber: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
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
  card: {
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  preparedForName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 3,
  },
  italicMuted: {
    marginTop: 6,
    color: '#64748b',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  body: {
    color: '#334155',
    lineHeight: 1.45,
  },
  estimateBanner: {
    border: '1 solid #bae6fd',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 10,
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
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  phaseTitle: {
    width: '72%',
    fontSize: 12,
    fontWeight: 700,
  },
  phaseMeta: {
    width: '26%',
    textAlign: 'right',
    color: '#64748b',
    fontSize: 9,
  },
  bullet: {
    marginTop: 3,
    marginLeft: 8,
    color: '#334155',
  },
  table: {
    marginTop: 8,
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
    borderBottom: '1 solid #e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
    borderBottom: '0.5 solid #e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
    borderBottom: '0.5 solid #e2e8f0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    backgroundColor: '#e2f4ff',
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
  appendixCard: {
    border: '1 solid #e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 1.4,
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
              <Svg width="32" height="32" viewBox="0 0 52 52">
                <Rect x="2" y="38" width="10" height="10" rx="2" fill="#0F172A" />
                <Rect x="14" y="28" width="10" height="20" rx="2" fill="#0F172A" />
                <Rect x="26" y="18" width="10" height="30" rx="2" fill="#0F172A" />
                <Rect x="38" y="4" width="10" height="44" rx="2" fill="#0EA5E9" />
              </Svg>
            </View>
            <View>
              <Text style={styles.companyName}>Trailhead Holdings Ltd</Text>
              <Text style={styles.muted}>Brentwood, Essex, UK</Text>
              <Text style={styles.muted}>rob@trailheadholdings.uk</Text>
            </View>
          </View>

          <View style={styles.rightMeta}>
            <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
            <Text style={styles.muted}>Issue date: {quote.issue_date}</Text>
            <Text style={styles.muted}>Valid until: {quote.valid_until ?? 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Prepared for:</Text>
          <Text style={styles.preparedForName}>{quote.account?.name ?? 'No account selected'}</Text>
          <Text style={styles.body}>{quote.contact?.name ?? 'No contact selected'}</Text>
          {quote.ai_generated ? (
            <Text style={styles.italicMuted}>AI-assisted estimate</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{quote.title}</Text>
        </View>

        {quote.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.body}>{quote.summary}</Text>
          </View>
        ) : null}

        {quote.ai_generated && (quote.estimated_hours || quote.estimated_timeline) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estimated Hours & Timeline</Text>
            <View style={styles.estimateBanner}>
              <Text style={styles.body}>
                Estimated: {quote.estimated_hours ?? '—'} hours
                {quote.estimated_timeline ? ` · ${quote.estimated_timeline}` : ''}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scope Of Work</Text>
          {quote.scope.length ? (
            quote.scope.map((phase, index) => (
              <View key={`${phase.phase}-${index}`} style={styles.phaseCard}>
                <View style={styles.phaseHeader}>
                  <Text style={styles.phaseTitle}>
                    {index + 1}. {phase.phase}
                  </Text>
                  <Text style={styles.phaseMeta}>
                    {phase.duration}
                    {phase.estimated_hours ? `\n${phase.estimated_hours} hrs` : ''}
                  </Text>
                </View>
                <Text style={styles.body}>{phase.description}</Text>
                {phase.deliverables.map((deliverable, deliverableIndex) => (
                  <Text key={`${phase.phase}-${deliverableIndex}`} style={styles.bullet}>
                    • {deliverable}
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.card}>
              <Text style={styles.body}>No scope phases added.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
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

            <View style={styles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>{formatMoney(totals.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>VAT ({quote.vat_rate}%)</Text>
              <Text>{formatMoney(totals.vat_amount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ fontWeight: 700 }}>Total</Text>
              <Text style={{ fontSize: 12, fontWeight: 700 }}>{formatMoney(totals.total)}</Text>
            </View>
          </View>
        </View>

        {quote.ai_generated && quote.complexity_breakdown ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Complexity Breakdown</Text>
            <View style={styles.appendixCard}>
              <Text style={styles.body}>How this estimate was calculated:</Text>
              {quote.complexity_breakdown.features_scored.map((feature, index) => (
                <Text key={`${feature}-${index}`} style={styles.bullet}>
                  • {feature}
                </Text>
              ))}
              <Text style={[styles.body, { marginTop: 8 }]}>
                Before buffer: {quote.complexity_breakdown.total_hours_before_buffer} hrs
              </Text>
              <Text style={styles.body}>
                Final after {quote.complexity_breakdown.buffer_applied}:{' '}
                {quote.complexity_breakdown.total_hours_final} hrs
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Terms</Text>
          <Text style={styles.body}>{quote.payment_terms ?? '—'}</Text>
        </View>

        {quote.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assumptions & Notes</Text>
            <Text style={styles.body}>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          This quote is valid until {quote.valid_until ?? 'the stated expiry date'}
          {'\n'}
          Trailhead Holdings Ltd · Registered in England & Wales
          {'\n'}
          {quote.quote_number}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderQuotePdf(quote: QuoteWithRelations) {
  return renderToBuffer(<QuoteDocument quote={quote} />)
}
