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
import { calculateTotals, roundMoney, type Account, type Contact, type Invoice, type InvoicePayment, type Workstream } from '@/lib/types'
import { formatMoney } from '@/lib/money'
import type { CompanySettings, CompanyBankAccount } from '@/lib/company-settings'

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
  invoiceHeading: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 2,
    marginBottom: 2,
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: 'right',
  },
  paidStamp: {
    marginTop: 10,
    marginLeft: 'auto',
    border: '2 solid #059669',
    color: '#059669',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
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
  fxNote: {
    marginTop: 10,
    marginLeft: 'auto',
    width: 300,
    fontSize: 8,
    color: '#475569',
    textAlign: 'right',
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

function InvoiceDocument({
  invoice,
  contact,
  account = null,
  workstream,
  companySettings,
  bankAccount = null,
  payments = [],
}: {
  invoice: Invoice
  contact: Contact | null
  account?: Account | null
  workstream: Workstream | null
  companySettings: CompanySettings | null
  bankAccount?: CompanyBankAccount | null
  payments?: InvoicePayment[]
}) {
  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
  const billTo = getInvoiceBillToDisplay(invoice, contact, account)
  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
  const amountDue = roundMoney(totals.total - amountPaid)
  const isSettled = amountPaid > 0 && amountDue <= 0.005
  const companyName = companySettings?.company_name ?? 'Trailhead Holdings Ltd'
  const companyLocality = [companySettings?.city, companySettings?.postcode].filter(Boolean).join(' ')
  const termsDays =
    invoice.due_date && invoice.issue_date
      ? Math.round((new Date(invoice.due_date).getTime() - new Date(invoice.issue_date).getTime()) / 86400000)
      : null
  // Per-currency bank account when set (e.g. the USD account for a USD invoice);
  // otherwise the legacy GBP fields on company settings.
  const bank: CompanyBankAccount | null = bankAccount ?? (companySettings
    ? {
        currency: 'GBP',
        account_name: companySettings.bank_account_name,
        bank_name: companySettings.bank_name,
        account_number: companySettings.bank_account_number,
        sort_code: companySettings.bank_sort_code,
        iban: companySettings.bank_iban,
        bic: companySettings.bank_bic,
        bank_address: null,
      }
    : null)
  const showPayment = Boolean(bank && (bank.account_number || bank.iban))
  const currency = invoice.currency ?? 'GBP'
  const fxRate = invoice.fx_rate_to_gbp ?? 1
  const isForeign = currency !== 'GBP'
  const gbpEquivalent = Math.round(totals.total * fxRate * 100) / 100
  // Prefer the quoted pair as entered (1 GBP = N foreign) for display; fall back
  // to the derived inverse for older invoices without a stored quote.
  const perGbp = invoice.fx_rate_quote ?? (fxRate > 0 ? 1 / fxRate : 0)
  const fxProvenance = [invoice.fx_rate_source, invoice.fx_rate_date].filter(Boolean).join(', ')

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
              <Text style={styles.companyName}>{companyName}</Text>
              {companySettings?.address_line1 ? <Text style={styles.muted}>{companySettings.address_line1}</Text> : null}
              {companySettings?.address_line2 ? <Text style={styles.muted}>{companySettings.address_line2}</Text> : null}
              {companyLocality ? <Text style={styles.muted}>{companyLocality}</Text> : null}
              {companySettings?.country ? <Text style={styles.muted}>{companySettings.country}</Text> : null}
              {companySettings?.company_number ? (
                <Text style={styles.muted}>Registered in England and Wales. Company number {companySettings.company_number}.</Text>
              ) : null}
              {companySettings?.company_email ? <Text style={styles.muted}>{companySettings.company_email}</Text> : null}
              {companySettings?.vat_registered && companySettings.vat_number ? (
                <Text style={styles.muted}>VAT: {companySettings.vat_number}</Text>
              ) : null}
            </View>
          </View>
          <View>
            <Text style={styles.invoiceHeading}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.muted}>Issue date: {invoice.issue_date}</Text>
            <Text style={styles.muted}>
              {invoice.due_date
                ? `Payment due by ${invoice.due_date}${termsDays != null && termsDays >= 0 ? ` (${termsDays} days)` : ''}`
                : 'Due date: Not set'}
            </Text>
            {invoice.po_number ? <Text style={styles.muted}>PO number: {invoice.po_number}</Text> : null}
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
            {billTo.bill_to_vat_number ? <Text style={styles.muted}>VAT number: {billTo.bill_to_vat_number}</Text> : null}
            {billTo.bill_to_company_number ? <Text style={styles.muted}>Company number: {billTo.bill_to_company_number}</Text> : null}
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
              <Text style={styles.colUnitPrice}>{formatMoney(item.unit_price, currency)}</Text>
              <Text style={styles.colLineTotal}>
                {formatMoney(item.qty * item.unit_price, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(totals.subtotal, currency)}</Text>
          </View>
          {invoice.vat_rate > 0 ? (
            <View style={styles.summaryRow}>
              <Text>VAT ({invoice.vat_rate}%)</Text>
              <Text>{formatMoney(totals.vat_amount, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text>Total</Text>
            <Text>{formatMoney(totals.total, currency)}</Text>
          </View>
          {amountPaid > 0 ? (
            <>
              <View style={{ ...styles.summaryRow, marginTop: 6 }}>
                <Text>Payments received</Text>
                <Text>-{formatMoney(amountPaid, currency)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>Amount due</Text>
                <Text>{formatMoney(Math.max(amountDue, 0), currency)}</Text>
              </View>
            </>
          ) : null}
          {isSettled ? <Text style={styles.paidStamp}>PAID IN FULL</Text> : null}
        </View>

        {invoice.vat_note ? (
          <View style={styles.fxNote}>
            <Text>{invoice.vat_note}</Text>
          </View>
        ) : null}

        {isForeign ? (
          <View style={styles.fxNote}>
            <Text>
              Total GBP equivalent {formatMoney(gbpEquivalent, 'GBP')} at 1 GBP = {perGbp.toFixed(4)} {currency}
              {fxProvenance ? ` (${fxProvenance})` : ''}. For reference only; the sterling amount received is subject to
              conversion and correspondent bank charges. Payable in {currency}.
            </Text>
          </View>
        ) : null}

        {showPayment && bank ? (
          <View style={styles.bankDetails}>
            <Text style={styles.sectionTitle}>Payment Details{currency !== 'GBP' ? ` (${currency})` : ''}</Text>
            <View style={styles.bankGrid}>
              <View style={styles.bankColumn}>
                {bank.bank_name ? (
                  <>
                    <Text style={styles.bankLabel}>Bank</Text>
                    <Text style={styles.bankValue}>{bank.bank_name}</Text>
                  </>
                ) : null}
                {bank.account_name ? (
                  <>
                    <Text style={styles.bankLabel}>Account name</Text>
                    <Text style={styles.bankValue}>{bank.account_name}</Text>
                  </>
                ) : null}
                {bank.sort_code ? (
                  <>
                    <Text style={styles.bankLabel}>Sort code</Text>
                    <Text style={styles.bankValue}>{bank.sort_code}</Text>
                  </>
                ) : null}
                {bank.account_number ? (
                  <>
                    <Text style={styles.bankLabel}>Account number</Text>
                    <Text style={styles.bankValue}>{bank.account_number}</Text>
                  </>
                ) : null}
              </View>
              {bank.iban || bank.bic || bank.bank_address ? (
                <View style={styles.bankColumn}>
                  {bank.iban ? (
                    <>
                      <Text style={styles.bankLabel}>IBAN</Text>
                      <Text style={styles.bankValue}>{bank.iban}</Text>
                    </>
                  ) : null}
                  {bank.bic ? (
                    <>
                      <Text style={styles.bankLabel}>BIC / SWIFT</Text>
                      <Text style={styles.bankValue}>{bank.bic}</Text>
                    </>
                  ) : null}
                  {bank.bank_address ? (
                    <>
                      <Text style={styles.bankLabel}>Bank address</Text>
                      <Text style={styles.bankValue}>{bank.bank_address}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
            {companySettings?.payment_terms ? (
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

        <Text style={styles.footer}>{companyName} · Trailhead OS</Text>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(
  invoice: Invoice,
  contact: Contact | null,
  workstream: Workstream | null,
  companySettings: CompanySettings | null = null,
  bankAccount: CompanyBankAccount | null = null,
  account: Account | null = null,
  payments: InvoicePayment[] = []
) {
  return renderToBuffer(
    <InvoiceDocument
      invoice={invoice}
      contact={contact}
      account={account}
      workstream={workstream}
      companySettings={companySettings}
      bankAccount={bankAccount}
      payments={payments}
    />
  )
}
