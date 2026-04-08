'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import PricingTierSelector from './PricingTierSelector'
import UnbilledExpensesWidget from './UnbilledExpensesWidget'
import { deriveInvoiceBillTo } from '@/lib/invoice-bill-to'
import {
  calculateTotals,
  type Account,
  type Contact,
  type ExpenseWithRelations,
  type Invoice,
  type LineItem,
  type PricingTier,
  type Workstream,
} from '@/lib/types'

function createEmptyLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    unit_price: 0,
  }
}

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
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
}: {
  accounts: Account[]
  contacts: Contact[]
  workstreams: Workstream[]
  initialInvoice?: Invoice
  initialAccountId?: string
  initialPricingTierId?: string
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
  const [vatRate, setVatRate] = useState(String(initialInvoice?.vat_rate ?? 20))
  const [notes, setNotes] = useState(initialInvoice?.notes ?? '')
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialInvoice?.line_items.length
      ? initialInvoice.line_items
      : []
  )
  const [savingAs, setSavingAs] = useState<'draft' | 'sent' | 'edit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pricingTierId, setPricingTierId] = useState<string | null>(
    initialInvoice?.pricing_tier_id ?? initialPricingTierId ?? null
  )
  const [showTierNotice, setShowTierNotice] = useState(false)
  const [billedExpenseIds, setBilledExpenseIds] = useState<string[]>([])
  const [billToName, setBillToName] = useState(initialInvoice?.bill_to_name ?? initialDerivedBillTo.bill_to_name ?? '')
  const [billToAddress, setBillToAddress] = useState(initialInvoice?.bill_to_address ?? initialDerivedBillTo.bill_to_address ?? '')
  const [billToCity, setBillToCity] = useState(initialInvoice?.bill_to_city ?? initialDerivedBillTo.bill_to_city ?? '')
  const [billToPostcode, setBillToPostcode] = useState(initialInvoice?.bill_to_postcode ?? initialDerivedBillTo.bill_to_postcode ?? '')
  const [billToCountry, setBillToCountry] = useState(initialInvoice?.bill_to_country ?? initialDerivedBillTo.bill_to_country ?? '')
  const [billToEmail, setBillToEmail] = useState(initialInvoice?.bill_to_email ?? initialDerivedBillTo.bill_to_email ?? '')
  const [billToPhone, setBillToPhone] = useState(initialInvoice?.bill_to_phone ?? initialDerivedBillTo.bill_to_phone ?? '')
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

  const totals = calculateTotals(lineItems, Number(vatRate) || 0)

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

    try {
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
        line_items: sanitizedLineItems,
        status: nextStatus === 'edit' ? initialInvoice?.status ?? 'draft' : nextStatus,
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

      router.push(`/invoicing/${data.invoice.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice')
      setSavingAs(null)
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Finance</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">
          {initialInvoice ? 'Edit invoice' : 'New invoice'}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Account</span>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
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
          <span className="text-sm text-slate-300">Client selector</span>
          <input
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            placeholder="Search contacts"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
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
          <span className="text-sm text-slate-300">Workstream</span>
          <select
            value={workstreamId}
            onChange={(event) => setWorkstreamId(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
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
          <span className="text-sm text-slate-300">VAT rate (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Issue date</span>
          <input
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
      </div>

      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Bill to</h2>
          <p className="mt-1 text-sm text-slate-400">
            Address fields can be pulled from the selected account or contact, then edited per invoice.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Recipient name</span>
            <input
              value={billToName}
              onChange={(event) => setBillToName(event.target.value)}
              placeholder="Company or recipient"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Address</span>
            <textarea
              value={billToAddress}
              onChange={(event) => setBillToAddress(event.target.value)}
              rows={4}
              placeholder="Street address"
              className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">City</span>
            <input
              value={billToCity}
              onChange={(event) => setBillToCity(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Postcode</span>
            <input
              value={billToPostcode}
              onChange={(event) => setBillToPostcode(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Country</span>
            <input
              value={billToCountry}
              onChange={(event) => setBillToCountry(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Recipient email</span>
            <input
              type="email"
              value={billToEmail}
              onChange={(event) => setBillToEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Recipient phone</span>
            <input
              value={billToPhone}
              onChange={(event) => setBillToPhone(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Pricing tier</h2>
          <p className="mt-1 text-sm text-slate-400">
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

      {/* Unbilled expenses for this account */}
      {accountId && (
        <UnbilledExpensesWidget
          accountId={accountId}
          onSelect={handleExpensesSelected}
        />
      )}

      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Line items</h2>
            <p className="text-sm text-slate-400">Calculated live in GBP.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLineItems((current) => [...current, createEmptyLineItem()])
            }}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Add line item
          </button>
        </div>

        {showTierNotice ? (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-[1.5rem] border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            <p>Tier updated - adjust line item rates manually if needed.</p>
            <button
              type="button"
              onClick={() => setShowTierNotice(false)}
              className="rounded-full border border-sky-400/30 px-2 py-1 text-xs font-medium text-sky-100 transition hover:border-sky-300"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {lineItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-sm text-slate-500">
              Select a pricing tier to pre-fill starter line items, or add your own manually.
            </div>
          ) : null}
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 md:grid-cols-[minmax(0,1fr)_90px_140px_140px_auto]"
            >
              <input
                value={item.description}
                onChange={(event) =>
                  updateLineItem(item.id, { description: event.target.value })
                }
                placeholder="Description"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={item.qty}
                onChange={(event) =>
                  updateLineItem(item.id, { qty: Number(event.target.value) })
                }
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
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
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              />
              <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                {formatMoney(item.qty * item.unit_price)}
              </div>
              <button
                type="button"
                onClick={() => removeLineItem(item.id)}
                className="rounded-2xl border border-rose-500/30 px-4 py-3 text-sm font-medium text-rose-200 transition hover:border-rose-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={8}
            className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/60 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Invoice summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Subtotal</dt>
              <dd className="font-medium text-slate-100">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">VAT ({Number(vatRate) || 0}%)</dt>
              <dd className="font-medium text-slate-100">{formatMoney(totals.vat_amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
              <dt className="text-base font-semibold text-slate-100">Total</dt>
              <dd className="text-lg font-semibold text-white">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {initialInvoice ? (
          <>
            <button
              type="button"
              onClick={() => submitInvoice('edit')}
              disabled={savingAs !== null}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {savingAs === 'edit' ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/invoicing/${initialInvoice.id}`)}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
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
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {savingAs === 'draft' ? 'Saving...' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={() => submitInvoice('sent')}
              disabled={savingAs !== null}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
            >
              {savingAs === 'sent' ? 'Saving...' : 'Mark as sent'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
