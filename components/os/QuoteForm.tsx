'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PricingTierSelector from './PricingTierSelector'
import SearchSelect from './SearchSelect'
import { apiFetch } from '@/lib/api-fetch'
import { calculateTotals } from '@/lib/types'
import type {
  Account,
  Contact,
  PricingTier,
  PricingType,
  Quote,
  QuoteLineItem,
  QuoteScope,
  QuoteStatus,
  Workstream,
} from '@/lib/types'

function createEmptyPhase(): QuoteScope {
  return {
    phase: '',
    description: '',
    deliverables: [],
    duration: '',
  }
}

function createEmptyLineItem(type: QuoteLineItem['type'] = 'fixed'): QuoteLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    unit_price: 0,
    type,
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

function buildStarterLineItems(
  pricingType: PricingType,
  tier: PricingTier
): QuoteLineItem[] {
  if (pricingType === 'time_and_materials') {
    return [
      {
        id: crypto.randomUUID(),
        description: 'Development (hourly)',
        qty: 1,
        unit_price: tier.hourly_rate,
        type: 'hourly',
      },
      {
        id: crypto.randomUUID(),
        description: 'Project management',
        qty: 1,
        unit_price: Math.round(tier.hourly_rate * 0.1),
        type: 'hourly',
      },
      {
        id: crypto.randomUUID(),
        description: 'Hosting & maintenance (monthly)',
        qty: 1,
        unit_price: tier.hosting_maintenance,
        type: 'fixed',
      },
    ]
  }

  if (pricingType === 'milestone') {
    return [
      {
        id: crypto.randomUUID(),
        description: 'Milestone 1 - Discovery & Design',
        qty: 1,
        unit_price: 0,
        type: 'milestone',
      },
      {
        id: crypto.randomUUID(),
        description: 'Milestone 2 - Development',
        qty: 1,
        unit_price: 0,
        type: 'milestone',
      },
      {
        id: crypto.randomUUID(),
        description: 'Milestone 3 - Testing & Launch',
        qty: 1,
        unit_price: 0,
        type: 'milestone',
      },
      {
        id: crypto.randomUUID(),
        description: 'Hosting & maintenance (monthly)',
        qty: 1,
        unit_price: tier.hosting_maintenance,
        type: 'fixed',
      },
    ]
  }

  return [
    {
      id: crypto.randomUUID(),
      description: 'Project development',
      qty: 1,
      unit_price: 0,
      type: 'fixed',
    },
    {
      id: crypto.randomUUID(),
      description: 'Project management',
      qty: 1,
      unit_price: 0,
      type: 'fixed',
    },
    {
      id: crypto.randomUUID(),
      description: 'Hosting & maintenance (monthly)',
      qty: 1,
      unit_price: tier.hosting_maintenance,
      type: 'fixed',
    },
  ]
}

interface QuoteFormProps {
  accounts: Account[]
  contacts: Contact[]
  workstreams: Workstream[]
  initialQuote?: Quote | null
  initialAccountId?: string
  initialEnquiryId?: string
  initialPricingTierId?: string
}

export default function QuoteForm({
  accounts,
  contacts,
  workstreams,
  initialQuote = null,
  initialAccountId = '',
  initialEnquiryId = '',
  initialPricingTierId = '',
}: QuoteFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialQuote?.title ?? '')
  const [accountId, setAccountId] = useState(initialQuote?.account_id ?? initialAccountId)
  const [contactId, setContactId] = useState(initialQuote?.contact_id ?? '')
  const [workstreamId, setWorkstreamId] = useState(initialQuote?.workstream_id ?? '')
  const [pricingType, setPricingType] = useState<PricingType>(initialQuote?.pricing_type ?? 'fixed')
  const [validUntil, setValidUntil] = useState(
    initialQuote?.valid_until ?? addDays(new Date(), 30)
  )
  const [issueDate, setIssueDate] = useState(
    initialQuote?.issue_date ?? new Date().toISOString().slice(0, 10)
  )
  const [summary, setSummary] = useState(initialQuote?.summary ?? '')
  const [scope, setScope] = useState<QuoteScope[]>(
    initialQuote?.scope.length ? initialQuote.scope : [createEmptyPhase()]
  )
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
    initialQuote?.line_items.length ? initialQuote.line_items : []
  )
  const [vatRate, setVatRate] = useState(String(initialQuote?.vat_rate ?? 20))
  const [paymentTerms, setPaymentTerms] = useState(
    initialQuote?.payment_terms ?? 'Payment terms: 50% deposit on acceptance, 50% on completion.'
  )
  const [notes, setNotes] = useState(initialQuote?.notes ?? '')
  const [savingAs, setSavingAs] = useState<QuoteStatus | 'edit' | null>(null)
  const [regeneratingAi, setRegeneratingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deliverableDrafts, setDeliverableDrafts] = useState<Record<number, string>>({})
  const [draggingPhaseIndex, setDraggingPhaseIndex] = useState<number | null>(null)
  const [quoteRecord, setQuoteRecord] = useState<Quote | null>(initialQuote)
  const [pricingTierId, setPricingTierId] = useState<string | null>(
    initialQuote?.pricing_tier_id ?? initialPricingTierId ?? null
  )
  const [pricingTier, setPricingTier] = useState<PricingTier | null>(
    initialQuote?.pricing_tier ?? null
  )
  const [lineItemsMode, setLineItemsMode] = useState<'empty' | 'auto' | 'manual'>(
    initialQuote?.line_items.length ? 'manual' : 'empty'
  )
  const [showTierNotice, setShowTierNotice] = useState(false)

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => !accountId || contact.account_id === accountId),
    [accountId, contacts]
  )
  const totals = calculateTotals(lineItems, Number(vatRate) || 0)

  useEffect(() => {
    if (!pricingTier || lineItemsMode !== 'auto') {
      return
    }

    setLineItems(buildStarterLineItems(pricingType, pricingTier))
  }, [lineItemsMode, pricingTier, pricingType])

  function updatePhase(index: number, patch: Partial<QuoteScope>) {
    setScope((current) => current.map((phase, phaseIndex) => (phaseIndex === index ? { ...phase, ...patch } : phase)))
  }

  function movePhase(fromIndex: number, toIndex: number) {
    setScope((current) => {
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  function updateLineItem(id: string, patch: Partial<QuoteLineItem>) {
    setLineItemsMode('manual')
    setLineItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeLineItem(id: string) {
    setLineItemsMode('manual')
    setLineItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)))
  }

  function applyStarterItemsForTier(tier: PricingTier) {
    setLineItems(buildStarterLineItems(pricingType, tier))
    setLineItemsMode('auto')
    setShowTierNotice(false)
  }

  function applyQuoteToForm(nextQuote: Quote) {
    setQuoteRecord(nextQuote)
    setTitle(nextQuote.title)
    setAccountId(nextQuote.account_id ?? '')
    setContactId(nextQuote.contact_id ?? '')
    setWorkstreamId(nextQuote.workstream_id ?? '')
    setPricingType(nextQuote.pricing_type)
    setValidUntil(nextQuote.valid_until ?? addDays(new Date(), 30))
    setIssueDate(nextQuote.issue_date ?? new Date().toISOString().slice(0, 10))
    setSummary(nextQuote.summary ?? '')
    setScope(nextQuote.scope.length ? nextQuote.scope : [createEmptyPhase()])
    setLineItems(nextQuote.line_items.length ? nextQuote.line_items : [])
    setVatRate(String(nextQuote.vat_rate ?? 20))
    setPaymentTerms(
      nextQuote.payment_terms ??
        'Payment terms: 50% deposit on acceptance, 50% on completion.'
    )
    setNotes(nextQuote.notes ?? '')
    setPricingTierId(nextQuote.pricing_tier_id ?? null)
    setPricingTier(nextQuote.pricing_tier ?? null)
    setLineItemsMode(nextQuote.line_items.length ? 'manual' : 'empty')
    setShowTierNotice(false)
    setError(null)
  }

  async function regenerateAiDraft() {
    if (!quoteRecord?.id || !quoteRecord.enquiry_id || regeneratingAi) {
      return
    }

    setRegeneratingAi(true)
    setError(null)

    try {
      const response = await apiFetch<{ quote: Quote }>(
        '/api/quotes/ai-draft',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enquiry_id: quoteRecord.enquiry_id,
            quote_id: quoteRecord.id,
            pricing_tier_id: pricingTierId ?? undefined,
            force_regenerate: true,
          }),
        }
      )

      applyQuoteToForm(response.quote)
      router.refresh()
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error
          ? regenerateError.message
          : 'Failed to regenerate AI draft'
      )
    } finally {
      setRegeneratingAi(false)
    }
  }

  async function submitQuote(nextStatus: QuoteStatus | 'edit') {
    setSavingAs(nextStatus)
    setError(null)

    const sanitizedScope = scope
      .map((phase) => ({
        phase: phase.phase.trim(),
        description: phase.description.trim(),
        deliverables: phase.deliverables.map((deliverable) => deliverable.trim()).filter(Boolean),
        duration: phase.duration.trim(),
      }))
      .filter((phase) => phase.phase || phase.description || phase.deliverables.length || phase.duration)

    const sanitizedLineItems = lineItems
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
      }))
      .filter((item) => item.description)

    if (!title.trim()) {
      setError('Title is required.')
      setSavingAs(null)
      return
    }

    if (sanitizedLineItems.some((item) => !Number.isFinite(item.qty) || !Number.isFinite(item.unit_price))) {
      setError('Each line item needs a valid quantity and unit price.')
      setSavingAs(null)
      return
    }

    try {
      const payload = {
        title,
        account_id: accountId || null,
        contact_id: contactId || null,
        workstream_id: workstreamId || null,
        enquiry_id: quoteRecord?.enquiry_id ?? initialEnquiryId ?? null,
        pricing_tier_id: pricingTierId,
        pricing_type: pricingType,
        valid_until: validUntil || null,
        issue_date: issueDate,
        summary,
        scope: sanitizedScope,
        line_items: sanitizedLineItems,
        vat_rate: Number(vatRate) || 0,
        payment_terms: paymentTerms,
        notes,
        status: nextStatus === 'edit' ? quoteRecord?.status ?? 'draft' : nextStatus,
        ai_generated: quoteRecord?.ai_generated ?? false,
        ai_generated_at: quoteRecord?.ai_generated_at ?? null,
      }

      const response = quoteRecord
        ? await fetch(`/api/quotes/${quoteRecord.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save quote')
      }

      router.push(`/quotes/${data.quote.id}`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save quote')
      setSavingAs(null)
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Commercial</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">
          {initialQuote ? 'Edit quote' : 'New quote'}
        </h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
        <label className="space-y-2 xl:col-span-6">
          <span className="text-sm text-slate-300">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <SearchSelect
          label="Account"
          value={accountId}
          options={accounts.map((account) => ({
            value: account.id,
            label: account.name,
            meta: account.website ?? account.industry ?? null,
          }))}
          onChange={(value) => {
            setAccountId(value)
            if (value && contacts.every((contact) => contact.id !== contactId || contact.account_id !== value)) {
              setContactId('')
            }
          }}
          placeholder="Search accounts"
          emptyLabel="No account"
        />

        <SearchSelect
          label="Contact"
          value={contactId}
          options={filteredContacts.map((contact) => ({
            value: contact.id,
            label: contact.name,
            meta: contact.company ?? contact.email ?? null,
          }))}
          onChange={setContactId}
          placeholder="Search contacts"
          emptyLabel="No contact"
        />

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
          <span className="text-sm text-slate-300">Pricing type</span>
          <select
            value={pricingType}
            onChange={(event) => setPricingType(event.target.value as PricingType)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="fixed">Fixed</option>
            <option value="time_and_materials">Time &amp; materials</option>
            <option value="milestone">Milestone</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Valid until</span>
          <input
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
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
      </div>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Summary</span>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={4}
          placeholder="Brief overview of what this quote covers..."
          className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </label>

      <section className="rounded-[1.75rem] border border-slate-800 bg-slate-950/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Scope of work</h2>
            <p className="text-sm text-slate-400">Build out delivery phases and reorder by dragging a card.</p>
          </div>
          <button
            type="button"
            onClick={() => setScope((current) => [...current, createEmptyPhase()])}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
          >
            Add phase
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {scope.map((phase, index) => (
            <div
              key={`${phase.phase}-${index}`}
              draggable
              onDragStart={() => setDraggingPhaseIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingPhaseIndex === null || draggingPhaseIndex === index) {
                  return
                }
                movePhase(draggingPhaseIndex, index)
                setDraggingPhaseIndex(null)
              }}
              className="rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Drag handle · Phase {index + 1}</span>
                <button
                  type="button"
                  onClick={() => setScope((current) => current.filter((_, phaseIndex) => phaseIndex !== index))}
                  className="rounded-2xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Phase name</span>
                  <input
                    value={phase.phase}
                    onChange={(event) => updatePhase(index, { phase: event.target.value })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Estimated duration</span>
                  <input
                    value={phase.duration}
                    onChange={(event) => updatePhase(index, { duration: event.target.value })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm text-slate-300">Description</span>
                <textarea
                  value={phase.description}
                  onChange={(event) => updatePhase(index, { description: event.target.value })}
                  rows={3}
                  className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                />
              </label>

              <div className="mt-4 space-y-2">
                <span className="text-sm text-slate-300">Deliverables</span>
                <div className="flex flex-wrap gap-2">
                  {phase.deliverables.map((deliverable, deliverableIndex) => (
                    <button
                      key={`${deliverable}-${deliverableIndex}`}
                      type="button"
                      onClick={() =>
                        updatePhase(index, {
                          deliverables: phase.deliverables.filter((_, entryIndex) => entryIndex !== deliverableIndex),
                        })
                      }
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
                    >
                      {deliverable} ×
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={deliverableDrafts[index] ?? ''}
                    onChange={(event) =>
                      setDeliverableDrafts((current) => ({
                        ...current,
                        [index]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') {
                        return
                      }
                      event.preventDefault()
                      const value = (deliverableDrafts[index] ?? '').trim()
                      if (!value) {
                        return
                      }
                      updatePhase(index, { deliverables: [...phase.deliverables, value] })
                      setDeliverableDrafts((current) => ({ ...current, [index]: '' }))
                    }}
                    placeholder="Type and press Enter"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-800 bg-slate-950/40 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Pricing tier</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the rate structure for this quote before building line items.
          </p>
        </div>

        <div className="mt-4">
          <PricingTierSelector
            value={pricingTierId}
            autoApplyInitialSelection={!initialQuote}
            onChange={(tier) => {
              setPricingTierId(tier?.id ?? null)
              setPricingTier(tier)
            }}
            onRatesApplied={(tier) => {
              setPricingTierId(tier.id)
              setPricingTier(tier)

              if (lineItems.length === 0) {
                applyStarterItemsForTier(tier)
                return
              }

              setLineItemsMode('manual')
              setShowTierNotice(true)
            }}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-800 bg-slate-950/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Line items</h2>
            <p className="text-sm text-slate-400">Same builder as invoices, with quote pricing type per line.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLineItemsMode('manual')
              setLineItems((current) => [
                ...current,
                createEmptyLineItem(
                  pricingType === 'milestone'
                    ? 'milestone'
                    : pricingType === 'time_and_materials'
                      ? 'hourly'
                      : 'fixed'
                ),
              ])
            }}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
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

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="pb-3">Description</th>
                <th className="pb-3">Type</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit £</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    Select a pricing tier to pre-fill starter line items, or add your own manually.
                  </td>
                </tr>
              ) : null}
              {lineItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="py-3">
                    <input
                      value={item.description}
                      onChange={(event) => updateLineItem(item.id, { description: event.target.value })}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    />
                  </td>
                  <td className="py-3">
                    <select
                      value={item.type}
                      onChange={(event) => updateLineItem(item.id, { type: event.target.value as QuoteLineItem['type'] })}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="hourly">Hourly</option>
                      <option value="milestone">Milestone</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.qty}
                      onChange={(event) => updateLineItem(item.id, { qty: Number(event.target.value) })}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-right text-sm text-slate-100"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateLineItem(item.id, { unit_price: Number(event.target.value) })}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-right text-sm text-slate-100"
                    />
                  </td>
                  <td className="py-3 text-right text-slate-100">{formatMoney(item.qty * item.unit_price)}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="rounded-2xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sticky bottom-4 mt-5 rounded-[1.5rem] border border-slate-800 bg-slate-950/95 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">VAT rate (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              />
            </label>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subtotal</p>
              <p className="mt-2 text-base font-medium text-slate-100">{formatMoney(totals.subtotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">VAT ({Number(vatRate) || 0}%)</p>
              <p className="mt-2 text-base font-medium text-slate-100">{formatMoney(totals.vat_amount)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Total</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totals.total)}</p>
            </div>
          </div>
        </div>
      </section>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Payment terms</span>
        <textarea
          value={paymentTerms}
          onChange={(event) => setPaymentTerms(event.target.value)}
          rows={4}
          className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
      </label>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {initialQuote ? (
          <>
            {quoteRecord?.enquiry_id ? (
              <button
                type="button"
                onClick={regenerateAiDraft}
                disabled={savingAs !== null || regeneratingAi}
                className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-400 disabled:opacity-60"
              >
                {regeneratingAi ? 'Regenerating AI draft...' : 'Redo AI draft'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => submitQuote('edit')}
              disabled={savingAs !== null || regeneratingAi}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {savingAs === 'edit' ? 'Saving...' : 'Save'}
            </button>
            <Link
              href={`/quotes/${initialQuote.id}`}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => submitQuote('draft')}
              disabled={savingAs !== null}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {savingAs === 'draft' ? 'Saving...' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={() => submitQuote('sent')}
              disabled={savingAs !== null}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
            >
              {savingAs === 'sent' ? 'Saving...' : 'Save & send'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
