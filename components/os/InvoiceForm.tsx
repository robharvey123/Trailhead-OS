'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import PricingTierSelector from './PricingTierSelector'
import UnbilledExpensesWidget from './UnbilledExpensesWidget'
import UnbilledTimeWidget from './UnbilledTimeWidget'
import { deriveInvoiceBillTo } from '@/lib/invoice-bill-to'
import {
  calculateTotals,
  type Account,
  type Contact,
  type ExpenseWithRelations,
  type Invoice,
  type LineItem,
  type PricingTier,
  type UnbilledTimeGroup,
  type Workstream,
} from '@/lib/types'
import { formatMoney, SUPPORTED_CURRENCIES } from '@/lib/money'

function createEmptyLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    unit_price: 0,
  }
}

function buildStarterLineItems(tier: PricingTier): LineItem[] {
  return [
    {
      id: crypto.randomUUID(),
      description: 'Development (hourly)',
      qty: 1,
      unit_price: tier.hourly_rate,
    },
    {
      id: crypto.randomUUID(),
      description: 'Project management',
      qty: 1,
      unit_price: Math.round(tier.hourly_rate * 0.1),
    },
    {
      id: crypto.randomUUID(),
      description: 'Hosting & maintenance (monthly)',
      qty: 1,
      unit_price: tier.hosting_maintenance,
    },
  ]
}

function getContactLabel(contact: Contact) {
  return contact.company ? `${contact.name} — ${contact.company}` : contact.name
}

function createEmptyContact(): Contact {
  return {
    id: '',
    workstream_id: null,
    account_id: null,
    name: '',
    company: null,
    email: null,
    phone: null,
    role: null,
    address_line1: null,
    address_line2: null,
    city: null,
    postcode: null,
    country: null,
    channel: null,
    website: null,
    status: 'lead',
    notes: null,
    tags: [],
    created_at: '',
    updated_at: '',
  }
}

export default function InvoiceForm({
  accounts,
  contacts,
  workstreams,
  initialInvoice,
  initialAccountId = '',
  initialPricingTierId = '',
  vatRegistered = true,
}: {
  accounts: Account[]
  contacts: Contact[]
  workstreams: Workstream[]
  initialInvoice?: Invoice
  initialAccountId?: string
  initialPricingTierId?: string
  vatRegistered?: boolean
}) {
  const router = useRouter()
  const initialContact =
    contacts.find((contact) => contact.id === initialInvoice?.contact_id) ?? createEmptyContact()
  const initialAccount = accounts.find((account) => account.id === (initialInvoice?.account_id ?? initialAccountId)) ?? null
  const initialDerivedBillTo = deriveInvoiceBillTo(initialAccount, initialContact.id ? initialContact : null)
  const [accountId, setAccountId] = useState(initialInvoice?.account_id ?? initialAccountId)
  const [contactSearch, setContactSearch] = useState(
    initialInvoice?.contact_id
      ? getContactLabel(
          contacts.find((contact) => contact.id === initialInvoice.contact_id) ?? createEmptyContact()
        )
      : ''
  )
  const [contactId, setContactId] = useState(initialInvoice?.contact_id ?? '')
  const [workstreamId, setWorkstreamId] = useState(initialInvoice?.workstream_id ?? '')
  const [issueDate, setIssueDate] = useState(
    initialInvoice?.issue_date ?? new Date().toISOString().slice(0, 10)
  )
  const [dueDate, setDueDate] = useState(initialInvoice?.due_date ?? '')
  const [vatRate, setVatRate] = useState(String(initialInvoice?.vat_rate ?? (vatRegistered ? 20 : 0)))
  const [notes, setNotes] = useState(initialInvoice?.notes ?? '')
  // Multi-currency: the client is billed in `currency`, but amounts are ENTERED in
  // GBP (authoritative) and converted at the quoted rate (1 GBP = N foreign). A GBP
  // invoice is unchanged. When editing a non-GBP invoice, the stored foreign line
  // prices are converted back to GBP for the form.
  const [currency, setCurrency] = useState(initialInvoice?.currency ?? 'GBP')
  const initialQuote =
    initialInvoice?.fx_rate_quote ??
    (initialInvoice?.fx_rate_to_gbp ? 1 / initialInvoice.fx_rate_to_gbp : 1)
  const [fxQuote, setFxQuote] = useState(
    initialInvoice?.currency && initialInvoice.currency !== 'GBP' && initialInvoice.fx_rate_quote
      ? String(initialInvoice.fx_rate_quote)
      : ''
  )
  const [fxSource, setFxSource] = useState(initialInvoice?.fx_rate_source ?? '')
  const [fxDate, setFxDate] = useState(initialInvoice?.fx_rate_date ?? '')
  const [fetchingRate, setFetchingRate] = useState(false)
  const [fxFetchError, setFxFetchError] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialInvoice?.line_items.length
      ? initialInvoice.currency && initialInvoice.currency !== 'GBP'
        ? initialInvoice.line_items.map((li) => ({ ...li, unit_price: Math.round((li.unit_price / (initialQuote || 1)) * 100) / 100 }))
        : initialInvoice.line_items
      : []
  )
  const [savingAs, setSavingAs] = useState<'draft' | 'sent' | 'edit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pricingTierId, setPricingTierId] = useState<string | null>(
    initialInvoice?.pricing_tier_id ?? initialPricingTierId ?? null
  )
  const [showTierNotice, setShowTierNotice] = useState(false)
  const [billedExpenseIds, setBilledExpenseIds] = useState<string[]>([])
  const [billedTimeEntryIds, setBilledTimeEntryIds] = useState<string[]>([])
  const [billToName, setBillToName] = useState(initialInvoice?.bill_to_name ?? initialDerivedBillTo.bill_to_name ?? '')
  const [billToAddress, setBillToAddress] = useState(initialInvoice?.bill_to_address ?? initialDerivedBillTo.bill_to_address ?? '')
  const [billToCity, setBillToCity] = useState(initialInvoice?.bill_to_city ?? initialDerivedBillTo.bill_to_city ?? '')
  const [billToPostcode, setBillToPostcode] = useState(initialInvoice?.bill_to_postcode ?? initialDerivedBillTo.bill_to_postcode ?? '')
  const [billToCountry, setBillToCountry] = useState(initialInvoice?.bill_to_country ?? initialDerivedBillTo.bill_to_country ?? '')
  const [billToEmail, setBillToEmail] = useState(initialInvoice?.bill_to_email ?? initialDerivedBillTo.bill_to_email ?? '')
  const [billToPhone, setBillToPhone] = useState(initialInvoice?.bill_to_phone ?? initialDerivedBillTo.bill_to_phone ?? '')
  const [isRecurring, setIsRecurring] = useState(initialInvoice?.is_recurring ?? false)
  const [recurringInterval, setRecurringInterval] = useState<'month' | 'year'>(initialInvoice?.recurring_interval ?? 'month')
  const selectionSyncReadyRef = useRef(false)

  const filteredContacts = contacts.filter((contact) => {
    if (accountId && contact.account_id !== accountId) {
      return false
    }
    const query = contactSearch.trim().toLowerCase()
    if (!query) {
      return true
    }

    return getContactLabel(contact).toLowerCase().includes(query)
  })

  // GBP totals are what Rob books; foreign totals are what the client is billed.
  const totals = calculateTotals(lineItems, Number(vatRate) || 0)
  const isForeign = currency !== 'GBP'
  const quote = isForeign ? Number(fxQuote) : 1
  const hasValidQuote = !isForeign || (Number.isFinite(quote) && quote > 0)
  // Catch the "typed the amount into the rate box" mistake (e.g. 3500).
  const rateLooksWrong = isForeign && Number.isFinite(quote) && quote > 0 && (quote < 0.02 || quote > 1000)

  async function fetchRate() {
    if (!isForeign) return
    setFetchingRate(true)
    setFxFetchError(null)
    try {
      const res = await fetch(`/api/fx/rate?from=GBP&to=${currency}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch rate')
      setFxQuote(String(data.rate))
      setFxSource(data.source)
      setFxDate(data.date)
    } catch (e) {
      setFxFetchError(e instanceof Error ? e.message : 'Failed to fetch rate')
    } finally {
      setFetchingRate(false)
    }
  }
  const foreignLineItems = isForeign && hasValidQuote
    ? lineItems.map((li) => ({ ...li, unit_price: Math.round(li.unit_price * quote * 100) / 100 }))
    : lineItems
  const foreignTotals = calculateTotals(foreignLineItems, Number(vatRate) || 0)

  useEffect(() => {
    if (!selectionSyncReadyRef.current) {
      selectionSyncReadyRef.current = true
      return
    }

    const nextAccount = accounts.find((account) => account.id === accountId) ?? null
    const nextContact = contacts.find((contact) => contact.id === contactId) ?? null
    const nextBillTo = deriveInvoiceBillTo(nextAccount, nextContact)

    setBillToName(nextBillTo.bill_to_name ?? '')
    setBillToAddress(nextBillTo.bill_to_address ?? '')
    setBillToCity(nextBillTo.bill_to_city ?? '')
    setBillToPostcode(nextBillTo.bill_to_postcode ?? '')
    setBillToCountry(nextBillTo.bill_to_country ?? '')
    setBillToEmail(nextBillTo.bill_to_email ?? '')
    setBillToPhone(nextBillTo.bill_to_phone ?? '')
  }, [accountId, contactId, accounts, contacts])

  function updateLineItem(id: string, patch: Partial<LineItem>) {
    setLineItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  function removeLineItem(id: string) {
    setLineItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id)
    )
  }

  function applyStarterItemsForTier(tier: PricingTier) {
    setLineItems(buildStarterLineItems(tier))
    setShowTierNotice(false)
  }

  function handleExpensesSelected(expenses: ExpenseWithRelations[]) {
    const expenseLineItems: LineItem[] = expenses.map((e) => ({
      id: crypto.randomUUID(),
      description: `Expense: ${e.description} (${e.date})`,
      qty: 1,
      unit_price: Number(e.amount),
    }))
    setLineItems((current) => [...current, ...expenseLineItems])
    setBilledExpenseIds((current) => [...current, ...expenses.map((e) => e.id)])
  }

  function handleTimeSelected(groups: UnbilledTimeGroup[]) {
    const timeLineItems: LineItem[] = groups.map((g) => ({
      id: crypto.randomUUID(),
      // Intentionally GBP: this is the hourly RATE, which comes from the
      // engagement, not the invoice. Rates are not multi-currency, so do not
      // "fix" this to the invoice currency — it would break the audit trail.
      description: `${g.project_name} — ${(g.minutes / 60).toFixed(2)}h @ £${g.rate.toFixed(2)}/h`,
      qty: 1,
      // Round to 2dp at creation so the OS total, PDF, and Stripe pence agree.
      unit_price: Math.round(g.amount * 100) / 100,
    }))
    setLineItems((current) => [...current, ...timeLineItems])
    setBilledTimeEntryIds((current) => [...current, ...groups.flatMap((g) => g.entry_ids)])
  }

  async function submitInvoice(nextStatus: 'draft' | 'sent' | 'edit') {
    setSavingAs(nextStatus)
    setError(null)

    const sanitizedLineItems = lineItems
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
      }))

    if (sanitizedLineItems.length === 0) {
      setError('Add at least one line item before saving.')
      setSavingAs(null)
      return
    }

    const hasInvalidLineItems = sanitizedLineItems.some(
      (item) =>
        !item.description ||
        !Number.isFinite(item.qty) ||
        item.qty < 1 ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0
    )

    if (hasInvalidLineItems) {
      setError('Each line item needs a description, quantity of at least 1, and a valid unit price.')
      setSavingAs(null)
      return
    }

    if (isForeign && !hasValidQuote) {
      setError(`Enter the exchange rate (1 GBP = N ${currency}) for a ${currency} invoice.`)
      setSavingAs(null)
      return
    }
    if (rateLooksWrong) {
      setError(`That exchange rate looks wrong (1 GBP = ${fxQuote} ${currency}). Enter the rate, e.g. ~1.3 for USD, not the amount.`)
      setSavingAs(null)
      return
    }

    try {
      // Amounts are entered in GBP; store line prices in the invoice currency so the
      // client sees the currency they pay. GBP invoices store as-is.
      const outLineItems = isForeign
        ? sanitizedLineItems.map((li) => ({ ...li, unit_price: Math.round(li.unit_price * quote * 100) / 100 }))
        : sanitizedLineItems
      const payload = {
        account_id: accountId || null,
        contact_id: contactId || null,
        workstream_id: workstreamId || null,
        pricing_tier_id: pricingTierId,
        issue_date: issueDate,
        due_date: dueDate || null,
        vat_rate: Number(vatRate) || 0,
        bill_to_name: billToName || null,
        bill_to_address: billToAddress || null,
        bill_to_city: billToCity || null,
        bill_to_postcode: billToPostcode || null,
        bill_to_country: billToCountry || null,
        bill_to_email: billToEmail || null,
        bill_to_phone: billToPhone || null,
        notes,
        line_items: outLineItems,
        currency,
        fx_rate_quote: isForeign ? quote : null,
        fx_rate_source: isForeign ? fxSource.trim() || null : null,
        fx_rate_date: isForeign ? fxDate.trim() || null : null,
        status: nextStatus === 'edit' ? initialInvoice?.status ?? 'draft' : nextStatus,
        is_recurring: isRecurring,
        recurring_interval: isRecurring ? recurringInterval : null,
      }

      if (initialInvoice) {
        const response = await fetch(`/api/invoices/${initialInvoice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update invoice')
        }

        if (billedExpenseIds.length > 0) {
          await fetch('/api/expenses/mark-billed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expense_ids: billedExpenseIds,
              invoice_id: data.invoice.id,
            }),
          })
        }

        if (billedTimeEntryIds.length > 0) {
          await fetch('/api/timesheet/mark-billed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time_entry_ids: billedTimeEntryIds,
              invoice_id: data.invoice.id,
            }),
          })
        }

        router.push(`/invoicing/${data.invoice.id}`)
        router.refresh()
        return
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      if (billedExpenseIds.length > 0) {
        await fetch('/api/expenses/mark-billed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expense_ids: billedExpenseIds,
            invoice_id: data.invoice.id,
          }),
        })
      }

      if (billedTimeEntryIds.length > 0) {
        await fetch('/api/timesheet/mark-billed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time_entry_ids: billedTimeEntryIds,
            invoice_id: data.invoice.id,
          }),
        })
      }

      router.push(`/invoicing/${data.invoice.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice')
      setSavingAs(null)
    }
  }

  return (
    <div className="os-card space-y-6 p-6">
      <div>
        <p className="os-eyebrow">Finance</p>
        <h1 className="os-page-title mt-2">
          {initialInvoice ? 'Edit invoice' : 'New invoice'}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Account</span>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="os-select w-full"
          >
            <option value="">No account selected</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Client selector</span>
          <input
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            placeholder="Search contacts"
            className="os-input w-full"
          />
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="os-select w-full"
          >
            <option value="">No client selected</option>
            {filteredContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {getContactLabel(contact)}
              </option>
            ))}
          </select>
        </div>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Workstream</span>
          <select
            value={workstreamId}
            onChange={(event) => setWorkstreamId(event.target.value)}
            className="os-select w-full"
          >
            <option value="">No workstream</option>
            {workstreams.map((workstream) => (
              <option key={workstream.id} value={workstream.id}>
                {workstream.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">VAT rate (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
            className="os-input w-full"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Currency</span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="os-select w-full"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Issue date</span>
          <input
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            className="os-input w-full"
          />
        </label>

        {isForeign ? (
          <div className="md:col-span-2 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
            <p className="text-sm font-medium text-[color:var(--text)]">Exchange rate</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[color:var(--text-2)]">
                Enter all amounts below in <strong>GBP</strong>. The client is billed in {currency} at this rate.
              </p>
              <button
                type="button"
                onClick={() => void fetchRate()}
                disabled={fetchingRate}
                className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)] disabled:opacity-50"
              >
                {fetchingRate ? 'Fetching…' : "Fetch today's rate (Wise)"}
              </button>
            </div>
            {fxFetchError ? (
              <p className="mt-2 text-xs text-[color:var(--red-strong)]">{fxFetchError}</p>
            ) : null}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-[color:var(--text-2)]">1 GBP = … {currency}</span>
                <input
                  type="number" min="0" step="0.0001" inputMode="decimal"
                  value={fxQuote}
                  onChange={(event) => setFxQuote(event.target.value)}
                  placeholder="e.g. 1.3481"
                  className="os-input w-full"
                />
                {rateLooksWrong ? (
                  <span className="text-xs text-[color:var(--red-strong)]">
                    That looks like an amount, not a rate. 1 GBP is about 1.3 {currency}.
                  </span>
                ) : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[color:var(--text-2)]">Rate source</span>
                <input
                  type="text"
                  value={fxSource}
                  onChange={(event) => setFxSource(event.target.value)}
                  placeholder="e.g. Wise mid-market"
                  className="os-input w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[color:var(--text-2)]">Rate date</span>
                <input
                  type="date"
                  value={fxDate ?? ''}
                  onChange={(event) => setFxDate(event.target.value)}
                  className="os-input w-full"
                />
              </label>
            </div>
          </div>
        ) : null}
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="os-input w-full"
          />
        </label>

        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(event) => setIsRecurring(event.target.checked)}
                className="sr-only"
              />
              <div
                className={`h-6 w-11 rounded-full transition-colors ${isRecurring ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}`}
              />
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="text-sm text-[color:var(--text-2)]">Recurring invoice</span>
          </label>

          {isRecurring && (
            <div className="mt-3">
              <span className="mb-2 block text-sm text-[color:var(--text-2)]">Billing cycle</span>
              <div className="flex gap-2">
                {(['month', 'year'] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => setRecurringInterval(interval)}
                    className={`rounded-2xl border px-4 py-2 text-sm transition-colors ${
                      recurringInterval === interval
                        ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                        : 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)] hover:border-[color:var(--accent)]'
                    }`}
                  >
                    {interval === 'month' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[color:var(--text-2)]">
                A new draft invoice will be automatically created each {recurringInterval === 'month' ? 'month' : 'year'} from the issue date.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="os-card-muted rounded-[1.75rem] p-4">
        <div>
          <h2 className="os-section-title">Bill to</h2>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            Address fields can be pulled from the selected account or contact, then edited per invoice.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-2)]">Recipient name</span>
            <input
              value={billToName}
              onChange={(event) => setBillToName(event.target.value)}
              placeholder="Company or recipient"
              className="os-input w-full"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-2)]">Address</span>
            <textarea
              value={billToAddress}
              onChange={(event) => setBillToAddress(event.target.value)}
              rows={4}
              placeholder="Street address"
              className="os-textarea w-full"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">City</span>
            <input
              value={billToCity}
              onChange={(event) => setBillToCity(event.target.value)}
              className="os-input w-full"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Postcode</span>
            <input
              value={billToPostcode}
              onChange={(event) => setBillToPostcode(event.target.value)}
              className="os-input w-full"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Country</span>
            <input
              value={billToCountry}
              onChange={(event) => setBillToCountry(event.target.value)}
              className="os-input w-full"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Recipient email</span>
            <input
              type="email"
              value={billToEmail}
              onChange={(event) => setBillToEmail(event.target.value)}
              className="os-input w-full"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-2)]">Recipient phone</span>
            <input
              value={billToPhone}
              onChange={(event) => setBillToPhone(event.target.value)}
              className="os-input w-full"
            />
          </label>
        </div>
      </div>

      <div className="os-card-muted rounded-[1.75rem] p-4">
        <div>
          <h2 className="os-section-title">Pricing tier</h2>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            Pick a rate structure before adding invoice line items.
          </p>
        </div>

        <div className="mt-4">
          <PricingTierSelector
            value={pricingTierId}
            autoApplyInitialSelection={!initialInvoice}
            onChange={(tier) => {
              setPricingTierId(tier?.id ?? null)
            }}
            onRatesApplied={(tier) => {
              setPricingTierId(tier.id)

              if (lineItems.length === 0) {
                applyStarterItemsForTier(tier)
                return
              }

              setShowTierNotice(true)
            }}
          />
        </div>
      </div>

      {/* Unbilled time and expenses for this account */}
      {accountId && (
        <UnbilledTimeWidget
          accountId={accountId}
          onSelect={handleTimeSelected}
        />
      )}

      {accountId && (
        <UnbilledExpensesWidget
          accountId={accountId}
          onSelect={handleExpensesSelected}
        />
      )}

      <div className="os-card-muted rounded-[1.75rem] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="os-section-title">Line items</h2>
            <p className="text-sm text-[color:var(--text-2)]">Calculated live in GBP.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLineItems((current) => [...current, createEmptyLineItem()])
            }}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
          >
            Add line item
          </button>
        </div>

        {showTierNotice ? (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-[1.5rem] border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
            <p>Tier updated - adjust line item rates manually if needed.</p>
            <button
              type="button"
              onClick={() => setShowTierNotice(false)}
              className="rounded-full border border-[color:var(--accent)] px-2 py-1 text-xs font-medium text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent-hover)]"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {lineItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center text-sm text-[color:var(--text-3)]">
              Select a pricing tier to pre-fill starter line items, or add your own manually.
            </div>
          ) : null}
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-3xl border border-[color:var(--border)] bg-white p-4 md:grid-cols-[minmax(0,1fr)_90px_140px_140px_auto]"
            >
              <input
                value={item.description}
                onChange={(event) =>
                  updateLineItem(item.id, { description: event.target.value })
                }
                placeholder="Description"
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)]"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={item.qty}
                onChange={(event) =>
                  updateLineItem(item.id, { qty: Number(event.target.value) })
                }
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)]"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(event) =>
                  updateLineItem(item.id, {
                    unit_price: Number(event.target.value),
                  })
                }
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)]"
              />
              <div className="flex items-center rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text-2)]">
                {formatMoney(item.qty * item.unit_price, 'GBP')}
              </div>
              <button
                type="button"
                onClick={() => removeLineItem(item.id)}
                className="rounded-2xl border border-[color:var(--red)] px-4 py-3 text-sm font-medium text-[color:var(--red-strong)] transition hover:border-[color:var(--red-strong)]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={8}
            className="os-textarea w-full"
          />
        </label>

        <div className="os-card-muted rounded-[1.75rem] p-5">
          <h2 className="os-section-title">Invoice summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[color:var(--text-2)]">Subtotal</dt>
              <dd className="font-medium text-[color:var(--text)]">{formatMoney(totals.subtotal, 'GBP')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[color:var(--text-2)]">VAT ({Number(vatRate) || 0}%)</dt>
              <dd className="font-medium text-[color:var(--text)]">{formatMoney(totals.vat_amount, 'GBP')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-3">
              <dt className="text-base font-semibold text-[color:var(--text)]">Total (GBP)</dt>
              <dd className="text-lg font-semibold text-[color:var(--text)]">{formatMoney(totals.total, 'GBP')}</dd>
            </div>
            {isForeign ? (
              <div className="flex items-center justify-between gap-4 rounded-[1rem] bg-[color:var(--accent-dim)] px-3 py-2">
                <dt className="text-sm font-medium text-[color:var(--text)]">
                  Client billed{fxQuote ? ` · 1 GBP = ${fxQuote} ${currency}` : ''}
                </dt>
                <dd className="text-base font-semibold text-[color:var(--text)]">
                  {hasValidQuote ? formatMoney(foreignTotals.total, currency) : `— ${currency}`}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {initialInvoice ? (
          <>
            <button
              type="button"
              onClick={() => submitInvoice('edit')}
              disabled={savingAs !== null}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {savingAs === 'edit' ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/invoicing/${initialInvoice.id}`)}
              className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => submitInvoice('draft')}
              disabled={savingAs !== null}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {savingAs === 'draft' ? 'Saving...' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={() => submitInvoice('sent')}
              disabled={savingAs !== null}
              className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] disabled:opacity-50"
            >
              {savingAs === 'sent' ? 'Saving...' : 'Mark as sent'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
