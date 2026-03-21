import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { FinanceInvoice, CompanyDetails } from './types'
import { currencySymbol } from '@/lib/format'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  badge: {
    fontSize: 10,
    color: '#475569',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaBlock: {
    width: '45%',
  },
  metaLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    marginBottom: 6,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottom: '0.5 solid #f1f5f9',
  },
  colDesc: { width: '50%' },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },
  headerText: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  summaryLabel: {
    width: 100,
    textAlign: 'right',
    paddingRight: 12,
    color: '#475569',
  },
  summaryValue: {
    width: 100,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1 solid #0f172a',
  },
  totalLabel: {
    width: 100,
    textAlign: 'right',
    paddingRight: 12,
    fontWeight: 700,
    fontSize: 12,
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
    fontWeight: 700,
    fontSize: 12,
  },
  notes: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
})

function fmtCur(value: number, code: string) {
  const sym = currencySymbol(code)
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function InvoicePDF({
  invoice,
  accountName,
  companyDetails,
}: {
  invoice: FinanceInvoice
  accountName: string | null
  companyDetails?: CompanyDetails | null
}) {
  const cur = invoice.currency || 'GBP'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice</Text>
            <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
          </View>
          <View>
            <Text style={styles.badge}>
              {invoice.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
            </Text>
            <Text style={styles.badge}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            {companyDetails?.company_name && (
              <>
                <Text style={styles.metaLabel}>From</Text>
                <Text style={styles.metaValue}>{companyDetails.company_name}</Text>
                {companyDetails.company_address && <Text style={{ fontSize: 9, color: '#475569' }}>{companyDetails.company_address}</Text>}
                {(companyDetails.company_city || companyDetails.company_postcode) && (
                  <Text style={{ fontSize: 9, color: '#475569' }}>
                    {[companyDetails.company_city, companyDetails.company_postcode].filter(Boolean).join(', ')}
                  </Text>
                )}
                {companyDetails.company_country && <Text style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>{companyDetails.company_country}</Text>}
                {companyDetails.company_vat_number && <Text style={{ fontSize: 8, color: '#94a3b8' }}>VAT: {companyDetails.company_vat_number}</Text>}
                {companyDetails.company_number && <Text style={{ fontSize: 8, color: '#94a3b8', marginBottom: 6 }}>Company No: {companyDetails.company_number}</Text>}
              </>
            )}
            {accountName && (
              <>
                <Text style={styles.metaLabel}>{invoice.direction === 'outgoing' ? 'Bill To' : 'Received From'}</Text>
                <Text style={styles.metaValue}>{invoice.bill_to_name || accountName}</Text>
                {invoice.bill_to_address && <Text style={{ fontSize: 9, color: '#475569' }}>{invoice.bill_to_address}</Text>}
                {(invoice.bill_to_city || invoice.bill_to_postcode) && (
                  <Text style={{ fontSize: 9, color: '#475569' }}>
                    {[invoice.bill_to_city, invoice.bill_to_postcode].filter(Boolean).join(', ')}
                  </Text>
                )}
                {invoice.bill_to_country && <Text style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>{invoice.bill_to_country}</Text>}
                {invoice.bill_to_email && <Text style={{ fontSize: 8, color: '#94a3b8' }}>{invoice.bill_to_email}</Text>}
                {invoice.bill_to_phone && <Text style={{ fontSize: 8, color: '#94a3b8' }}>{invoice.bill_to_phone}</Text>}
                {invoice.bill_to_vat_number && <Text style={{ fontSize: 8, color: '#94a3b8' }}>VAT: {invoice.bill_to_vat_number}</Text>}
                {invoice.bill_to_company_number && <Text style={{ fontSize: 8, color: '#94a3b8', marginBottom: 6 }}>Company No: {invoice.bill_to_company_number}</Text>}
              </>
            )}
            <Text style={styles.metaLabel}>Currency</Text>
            <Text style={styles.metaValue}>{cur}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Issue Date</Text>
            <Text style={styles.metaValue}>{invoice.issue_date}</Text>
            {invoice.due_date && (
              <>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={styles.metaValue}>{invoice.due_date}</Text>
              </>
            )}
            {invoice.payment_terms && (
              <>
                <Text style={styles.metaLabel}>Payment Terms</Text>
                <Text style={styles.metaValue}>{invoice.payment_terms}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDesc]}>Description</Text>
            <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
          </View>
          {(invoice.line_items || []).map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description || '—'}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{fmtCur(item.unit_price, cur)}</Text>
              <Text style={styles.colTotal}>{fmtCur(item.total, cur)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmtCur(invoice.subtotal, cur)}</Text>
          </View>
          {invoice.discount_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={styles.summaryValue}>-{fmtCur(invoice.discount_amount, cur)}</Text>
            </View>
          )}
          {invoice.tax_rate > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax ({invoice.tax_rate}%)</Text>
              <Text style={styles.summaryValue}>{fmtCur(invoice.tax_amount, cur)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmtCur(invoice.total, cur)}</Text>
          </View>
          {invoice.amount_paid > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={styles.summaryValue}>{fmtCur(invoice.amount_paid, cur)}</Text>
            </View>
          )}
          {invoice.amount_paid > 0 && invoice.amount_paid < invoice.total && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontWeight: 700 }]}>Balance Due</Text>
              <Text style={[styles.summaryValue, { fontWeight: 700 }]}>
                {fmtCur(invoice.total - invoice.amount_paid, cur)}
              </Text>
            </View>
          )}
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {(companyDetails?.bank_name || companyDetails?.bank_account_number || companyDetails?.bank_iban) && (
          <View style={{ marginTop: 24, padding: 12, backgroundColor: '#f8fafc', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bank Details</Text>
            {companyDetails.bank_name && <Text style={{ fontSize: 9, color: '#475569' }}>{companyDetails.bank_name}</Text>}
            {companyDetails.bank_account_name && <Text style={{ fontSize: 9, color: '#475569' }}>{companyDetails.bank_account_name}</Text>}
            {companyDetails.bank_sort_code && <Text style={{ fontSize: 9, color: '#475569' }}>Sort Code: {companyDetails.bank_sort_code}</Text>}
            {companyDetails.bank_account_number && <Text style={{ fontSize: 9, color: '#475569' }}>Account: {companyDetails.bank_account_number}</Text>}
            {companyDetails.bank_iban && <Text style={{ fontSize: 9, color: '#475569' }}>IBAN: {companyDetails.bank_iban}</Text>}
            {companyDetails.bank_swift && <Text style={{ fontSize: 9, color: '#475569' }}>BIC/SWIFT: {companyDetails.bank_swift}</Text>}
          </View>
        )}

        <Text style={styles.footer}>
          Invoice #{invoice.invoice_number} · Generated {new Date().toISOString().slice(0, 10)}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(
  invoice: FinanceInvoice,
  accountName: string | null,
  companyDetails?: CompanyDetails | null
): Promise<Buffer> {
  return renderToBuffer(
    <InvoicePDF invoice={invoice} accountName={accountName} companyDetails={companyDetails} />
  )
}
