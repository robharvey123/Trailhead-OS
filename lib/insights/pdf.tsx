import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { InsightsData } from './data'
import type { InsightsNarrative } from './narrative'
import { formatCurrency, formatMonthLabel, formatNumber, formatPercent } from '@/lib/format'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    border: '1 solid #e2e8f0',
    borderRadius: 6,
    padding: 8,
    width: '48%',
  },
  cardLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  listItem: {
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 700,
  },
  cellMonth: { width: '22%' },
  cellValue: { width: '13%', textAlign: 'right' },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  chartLabel: {
    width: 60,
    fontSize: 9,
  },
  barContainer: {
    width: 200,
    height: 8,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
  },
  bar: {
    height: 8,
    backgroundColor: '#38bdf8',
  },
})

const buildPdf = (
  data: InsightsData,
  narrative: InsightsNarrative | null
) => {
  const periodLabel = data.start || data.end
    ? `${data.start || 'Start'} → ${data.end || 'Latest'}`
    : 'All months'

  const totalsCards = [
    { label: 'Total Sell In', value: formatNumber(data.totals.sellIn) },
    { label: 'Total Shipped', value: formatNumber(data.totals.totalShipped) },
    { label: 'Total Sell Out', value: formatNumber(data.totals.sellOut) },
    { label: 'Channel Stock', value: formatNumber(data.totals.channelStock) },
    { label: 'Sell Through', value: formatPercent(data.totals.sellThrough) },
    {
      label: 'Revenue',
      value: formatCurrency(data.totals.revenue, data.currencySymbol),
    },
  ]

  const maxSellOut = Math.max(
    1,
    ...data.monthlySummary.map((row) => row.sellOut)
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Monthly S&OP Report</Text>
          <Text style={styles.subtitle}>
            Brand: {data.brand || 'All'} • Period: {periodLabel}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive summary</Text>
          {narrative ? (
            <Text>{narrative.summary}</Text>
          ) : (
            <Text>Summary not generated yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key metrics</Text>
          <View style={styles.cardRow}>
            {totalsCards.map((card) => (
              <View key={card.label} style={styles.card}>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sell-out trend</Text>
          {data.monthlySummary.slice(-6).map((row) => {
            const width = (row.sellOut / maxSellOut) * 200
            return (
              <View key={row.month} style={styles.chartRow}>
                <Text style={styles.chartLabel}>
                  {formatMonthLabel(row.month)}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width }]} />
                </View>
                <Text>{formatNumber(row.sellOut)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly summary</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.cellMonth}>Month</Text>
              <Text style={styles.cellValue}>Sell In</Text>
              <Text style={styles.cellValue}>Promo</Text>
              <Text style={styles.cellValue}>Shipped</Text>
              <Text style={styles.cellValue}>Sell Out</Text>
              <Text style={styles.cellValue}>Variance</Text>
            </View>
            {data.monthlySummary.map((row) => (
              <View key={row.month} style={styles.tableRow}>
                <Text style={styles.cellMonth}>
                  {formatMonthLabel(row.month)}
                </Text>
                <Text style={styles.cellValue}>
                  {formatNumber(row.sellIn)}
                </Text>
                <Text style={styles.cellValue}>
                  {formatNumber(row.promo)}
                </Text>
                <Text style={styles.cellValue}>
                  {formatNumber(row.totalShipped)}
                </Text>
                <Text style={styles.cellValue}>
                  {formatNumber(row.sellOut)}
                </Text>
                <Text style={styles.cellValue}>
                  {formatNumber(row.variance)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {narrative ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {narrative.highlights.map((item, index) => (
              <Text key={`highlight-${index}`} style={styles.listItem}>
                • {item}
              </Text>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Risks</Text>
            {narrative.risks.map((item, index) => (
              <Text key={`risk-${index}`} style={styles.listItem}>
                • {item}
              </Text>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Actions</Text>
            {narrative.actions.map((item, index) => (
              <Text key={`action-${index}`} style={styles.listItem}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

export const renderInsightsPdf = async (
  data: InsightsData,
  narrative: InsightsNarrative | null
) => {
  const document = buildPdf(data, narrative)
  const buffer = await renderToBuffer(document)
  return buffer
}
