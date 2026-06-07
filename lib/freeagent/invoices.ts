import { createClient } from '@/lib/supabase/service'
import type { LineItem } from '@/lib/types'
import { faFetch } from './client'
import { resolveInvoiceContactUrl } from './contacts'

// Consulting/dev work — quantity × price. Configurable later if needed.
const ITEM_TYPE = 'Services'

/**
 * Push a Trailhead OS invoice into FreeAgent (as a Draft — FreeAgent's default
 * for API-created invoices), storing the link back. Idempotent: returns early if
 * already pushed (the freeagent_invoice_url guard against double entry).
 *
 * FreeAgent recalculates totals from the line items, so we send lines only.
 * sales_tax_rate per line is the invoice's own vat_rate (so VAT is whatever the
 * invoice was raised at — no hardcoding).
 */
export async function pushInvoiceToFreeAgent(invoiceId: string): Promise<string> {
  const supabase = createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, account_id, contact_id, bill_to_name, bill_to_email, bill_to_address, bill_to_city, bill_to_postcode, bill_to_country, issue_date, due_date, line_items, vat_rate, freeagent_invoice_url, deleted_at')
    .eq('id', invoiceId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load invoice')
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.deleted_at) throw new Error('Invoice has been deleted')
  if (invoice.freeagent_invoice_url) return invoice.freeagent_invoice_url as string

  // Resolve a FreeAgent contact: account → contact → bill-to (handles account-less invoices).
  const contactUrl = await resolveInvoiceContactUrl({
    account_id: (invoice.account_id as string | null) ?? null,
    contact_id: (invoice.contact_id as string | null) ?? null,
    bill_to_name: (invoice.bill_to_name as string | null) ?? null,
    bill_to_email: (invoice.bill_to_email as string | null) ?? null,
    bill_to_address: (invoice.bill_to_address as string | null) ?? null,
    bill_to_city: (invoice.bill_to_city as string | null) ?? null,
    bill_to_postcode: (invoice.bill_to_postcode as string | null) ?? null,
    bill_to_country: (invoice.bill_to_country as string | null) ?? null,
  })

  const currency = invoice.account_id
    ? ((await supabase.from('accounts').select('currency').eq('id', invoice.account_id).maybeSingle()).data?.currency as string | null) ?? 'GBP'
    : 'GBP'
  const vatRate = Number(invoice.vat_rate ?? 0)
  const lineItems = (invoice.line_items ?? []) as LineItem[]
  if (lineItems.length === 0) throw new Error('Invoice has no line items.')

  // Payment terms from issue → due, default 30.
  let terms = 30
  if (invoice.issue_date && invoice.due_date) {
    const days = Math.round((new Date(invoice.due_date as string).getTime() - new Date(invoice.issue_date as string).getTime()) / 86_400_000)
    if (days > 0) terms = days
  }

  const payload = {
    invoice: {
      contact: contactUrl,
      dated_on: invoice.issue_date, // YYYY-MM-DD date column
      payment_terms_in_days: terms,
      currency,
      invoice_items: lineItems.map((li) => ({
        item_type: ITEM_TYPE,
        description: li.description,
        quantity: li.qty,
        price: li.unit_price,
        sales_tax_rate: vatRate,
      })),
    },
  }

  const res = await faFetch('/invoices', { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FreeAgent invoice create failed (${res.status}): ${text.slice(0, 400)}`)
  }
  const json = (await res.json()) as { invoice?: { url?: string } }
  const url = json.invoice?.url
  if (!url) throw new Error('FreeAgent did not return an invoice URL')

  await supabase
    .from('invoices')
    .update({ freeagent_invoice_url: url, freeagent_synced_at: new Date().toISOString() })
    .eq('id', invoiceId)
  return url
}
