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
import { getInvoiceBillToDisplay } from '@/lib/invoice-bill-to'
import { calculateTotals, type Contact, type Invoice, type Workstream } from '@/lib/types'
import type { CompanySettings } from '@/lib/company-settings'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMark: {
    marginRight: 10,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: '#475569',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748b',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metaBlock: {
    width: '48%',
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
    paddingVertical: 6,
  },
  colDescription: {
    width: '46%',
  },
  colQty: {
    width: '12%',
    textAlign: 'right',
  },
  colUnitPrice: {
    width: '18%',
    textAlign: 'right',
  },
  colLineTotal: {
    width: '24%',
    textAlign: 'right',
  },
  summary: {
    marginTop: 18,
    marginLeft: 'auto',
    width: 220,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1 solid #0f172a',
    paddingTop: 8,
    marginTop: 4,
    fontWeight: 700,
  },
  bankDetails: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: '1 solid #e2e8f0',
  },
  bankGrid: {
    flexDirection: 'row',
    gap: 48,
  },
  bankColumn: {
    flex: 1,
  },
  bankLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
  },
  bankValue: {
    marginBottom: 6,
  },
  notes: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: '1 solid #e2e8f0',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 8,
    color: '#64748b',
  },
})

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

function InvoiceDocument({
  invoice,
  contact,
  workstream,
  companySettings,
}: {
  invoice: Invoice
  contact: Contact | null
  workstream: Workstream | null
  companySettings: CompanySettings | null
}) {
  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
  const billTo = getInvoiceBillToDisplay(invoice, contact)
  const showPayment = Boolean(companySettings?.bank_account_number)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
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
              <Text style={styles.muted}>Registered in England &amp; Wales</Text>
              <Text style={styles.muted}>rob@trailheadholdings.com</Text>
              {companySettings?.vat_registered && companySettings.vat_number ? (
                <Text style={styles.muted}>VAT: {companySettings.vat_number}</Text>
              ) : null}
            </View>
          </View>
          <View>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.muted}>Issue date: {invoice.issue_date}</Text>
            <Text style={styles.muted}>
              Due date: {invoice.due_date ?? 'Not set'}
            </Text>
            {workstream ? (
              <Text style={styles.muted}>Workstream: {workstream.label}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text>{billTo.bill_to_name ?? 'No client selected'}</Text>
            {billTo.bill_to_address ? <Text style={styles.muted}>{billTo.bill_to_address}</Text> : null}
            {billTo.bill_to_city || billTo.bill_to_postcode ? (
              <Text style={styles.muted}>
                {[billTo.bill_to_city, billTo.bill_to_postcode].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {billTo.bill_to_country ? <Text style={styles.muted}>{billTo.bill_to_country}</Text> : null}
            {billTo.bill_to_email ? <Text style={styles.muted}>{billTo.bill_to_email}</Text> : null}
            {billTo.bill_to_phone ? <Text style={styles.muted}>{billTo.bill_to_phone}</Text> : null}
          </View>
        </View>

        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colUnitPrice}>Unit price</Text>
            <Text style={styles.colLineTotal}>Line total</Text>
          </View>
          {invoice.line_items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description || '—'}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnitPrice}>{formatMoney(item.unit_price)}</Text>
              <Text style={styles.colLineTotal}>
                {formatMoney(item.qty * item.unit_price)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(totals.subtotal)}</Text>
          </View>
          {invoice.vat_rate > 0 ? (
            <View style={styles.summaryRow}>
              <Text>VAT ({invoice.vat_rate}%)</Text>
              <Text>{formatMoney(totals.vat_amount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text>Total</Text>
            <Text>{formatMoney(totals.total)}</Text>
          </View>
        </View>

        {showPayment && companySettings ? (
          <View style={styles.bankDetails}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.bankGrid}>
              <View style={styles.bankColumn}>
                {companySettings.bank_name ? (
                  <>
                    <Text style={styles.bankLabel}>Bank</Text>
                    <Text style={styles.bankValue}>{companySettings.bank_name}</Text>
                  </>
                ) : null}
                {companySettings.bank_account_name ? (
                  <>
                    <Text style={styles.bankLabel}>Account name</Text>
                    <Text style={styles.bankValue}>{companySettings.bank_account_name}</Text>
                  </>
                ) : null}
                {companySettings.bank_sort_code ? (
                  <>
                    <Text style={styles.bankLabel}>Sort code</Text>
                    <Text style={styles.bankValue}>{companySettings.bank_sort_code}</Text>
                  </>
                ) : null}
                <Text style={styles.bankLabel}>Account number</Text>
                <Text style={styles.bankValue}>{companySettings.bank_account_number}</Text>
              </View>
              {companySettings.bank_iban || companySettings.bank_bic ? (
                <View style={styles.bankColumn}>
                  {companySettings.bank_iban ? (
                    <>
                      <Text style={styles.bankLabel}>IBAN</Text>
                      <Text style={styles.bankValue}>{companySettings.bank_iban}</Text>
                    </>
                  ) : null}
                  {companySettings.bank_bic ? (
                    <>
                      <Text style={styles.bankLabel}>BIC</Text>
                      <Text style={styles.bankValue}>{companySettings.bank_bic}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
            {companySettings.payment_terms ? (
              <Text style={{ ...styles.muted, marginTop: 4 }}>{companySettings.payment_terms}</Text>
            ) : null}
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Payment terms / notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>Trailhead Holdings Ltd · Trailhead OS</Text>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(
  invoice: Invoice,
  contact: Contact | null,
  workstream: Workstream | null,
  companySettings: CompanySettings | null = null
) {
  return renderToBuffer(
    <InvoiceDocument
      invoice={invoice}
      contact={contact}
      workstream={workstream}
      companySettings={companySettings}
    />
  )
}
