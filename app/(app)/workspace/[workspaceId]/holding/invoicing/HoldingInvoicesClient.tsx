'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { currencySymbol } from '@/lib/format'
import type { FinanceInvoice, InvoiceStatus, InvoiceDirection, InvoiceLineItem } from '@/lib/finance/types'
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/finance/types'
import type { IncomeStream } from '@/lib/holding/types'

type AccountOption = { id: string; name: string }

export default function HoldingInvoicesClient({ workspaceId, baseCurrency }: { workspaceId: string; baseCurrency: string }) {
  const fmtCurrency = (v: number) => `${currencySymbol(baseCurrency)}${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([])
  const [streams, setStreams] = useState<IncomeStream[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterStream, setFilterStream] = useState<string>('all')

  // Form
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [accountId, setAccountId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [direction, setDirection] = useState<InvoiceDirection>('outgoing')
  const [status, setStatus] = useState<InvoiceStatus>('draft')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [currency, setCurrency] = useState('GBP')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])

  const resetForm = () => {
    setInvoiceNumber(''); setAccountId(''); setStreamId(''); setDirection('outgoing'); setStatus('draft')
    setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setTaxRate('0'); setCurrency('GBP')
    setNotes(''); setLineItems([]); setEditingId(null)
  }

  const addLineItem = () => setLineItems((prev) => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 }])
  const removeLineItem = (id: string) => setLineItems((prev) => prev.filter((i) => i.id !== id))
  const updateLineItem = (id: string, field: string, value: string | number) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.total = updated.quantity * updated.unit_price
      return updated
    }))
  }

  const load = useCallback(async () => {
    try {
      const [invRes, strRes, accRes] = await Promise.all([
        apiFetch<{ invoices: FinanceInvoice[] }>(`/api/finance/invoices?workspace_id=${workspaceId}`),
        apiFetch<{ streams: IncomeStream[] }>(`/api/holding/streams?workspace_id=${workspaceId}`),
        apiFetch<{ accounts: AccountOption[] }>(`/api/crm/accounts?workspace_id=${workspaceId}`),
      ])
      setInvoices(invRes.invoices ?? [])
      setStreams(strRes.streams ?? [])
      setAccounts(accRes.accounts ?? [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const streamMap = new Map(streams.map((s) => [s.id, s.name]))

  const openEdit = (inv: FinanceInvoice) => {
    setInvoiceNumber(inv.invoice_number); setAccountId(inv.account_id || ''); setStreamId(inv.stream_id || '')
    setDirection(inv.direction); setStatus(inv.status); setIssueDate(inv.issue_date)
    setDueDate(inv.due_date || ''); setTaxRate(inv.tax_rate.toString()); setCurrency(inv.currency)
    setNotes(inv.notes || ''); setLineItems(inv.line_items || []); setEditingId(inv.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, invoice_number: invoiceNumber, account_id: accountId || null,
        stream_id: streamId || null, direction, status, issue_date: issueDate, due_date: dueDate || null,
        tax_rate: parseFloat(taxRate) || 0, currency, notes: notes || null, line_items: lineItems,
      }
      if (editingId) {
        const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
        const taxAmount = subtotal * ((parseFloat(taxRate) || 0) / 100)
        const total = subtotal + taxAmount
        const { invoice } = await apiFetch<{ invoice: FinanceInvoice }>(`/api/finance/invoices/${editingId}?workspace_id=${workspaceId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, subtotal, tax_amount: taxAmount, total, line_items: lineItems }),
        })
        setInvoices((prev) => prev.map((i) => i.id === editingId ? invoice : i))
      } else {
        const { invoice } = await apiFetch<{ invoice: FinanceInvoice }>('/api/finance/invoices', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setInvoices((prev) => [invoice, ...prev])
      }
      resetForm(); setShowForm(false)
      toast.success(editingId ? 'Invoice updated' : 'Invoice created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, editingId, invoiceNumber, accountId, streamId, direction, status, issueDate, dueDate, taxRate, currency, notes, lineItems])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/finance/invoices/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setInvoices((prev) => prev.filter((i) => i.id !== id))
      toast.success('Invoice deleted')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete') }
  }, [workspaceId])

  const filtered = invoices.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterStream !== 'all' && i.stream_id !== filterStream) return false
    return true
  })

  const totals = useMemo(() => ({
    outstanding: filtered.filter((i) => !['paid', 'cancelled', 'refunded'].includes(i.status)).reduce((s, i) => s + i.total - i.amount_paid, 0),
    paid: filtered.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
  }), [filtered])

  if (loading) {
    return (
      <div className="space-y-6">
        <header><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p><h1 className="mt-2 text-2xl font-semibold">Invoicing</h1></header>
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-1 text-2xl font-semibold">Invoicing</h1>
          <p className="mt-1 text-sm text-slate-400">Outstanding: {fmtCurrency(totals.outstanding)} &middot; Paid: {fmtCurrency(totals.paid)}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Invoice</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterStream} onChange={(e) => setFilterStream(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All streams</option>
          {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Invoice' : 'New Invoice'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Invoice # *</label><input required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Stream</label><select value={streamId} onChange={(e) => setStreamId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Account</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Direction</label><select value={direction} onChange={(e) => setDirection(e.target.value as InvoiceDirection)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="outgoing">Outgoing</option><option value="incoming">Incoming</option></select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{INVOICE_STATUSES.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Issue Date</label><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Tax Rate (%)</label><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Currency</label><input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><label className="text-xs text-slate-400">Line Items</label><button type="button" onClick={addLineItem} className="text-xs text-blue-400 hover:text-blue-300">+ Add item</button></div>
              {lineItems.map((item) => (
                <div key={item.id} className="mb-2 grid grid-cols-12 gap-2 items-center">
                  <input placeholder="Description" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} className="col-span-5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <input type="number" step="0.01" placeholder="Price" value={item.unit_price} onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <span className="col-span-2 text-right text-sm text-slate-300">{fmtCurrency(item.quantity * item.unit_price)}</span>
                  <button type="button" onClick={() => removeLineItem(item.id)} className="col-span-1 text-xs text-rose-400 hover:text-rose-300">&times;</button>
                </div>
              ))}
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Stream</th><th className="px-4 py-3">Dir.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No invoices found</td></tr> : filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-slate-400">{inv.stream_id ? (streamMap.get(inv.stream_id) || '—') : '—'}</td>
                <td className="px-4 py-3 text-slate-400">{inv.direction === 'incoming' ? '↓ In' : '↑ Out'}</td>
                <td className="px-4 py-3 text-slate-400">{inv.issue_date}</td>
                <td className="px-4 py-3 text-slate-400">{inv.due_date || '—'}</td>
                <td className="px-4 py-3 font-medium">{fmtCurrency(inv.total)}</td>
                <td className="px-4 py-3 text-slate-400">{fmtCurrency(inv.amount_paid)}</td>
                <td className="px-4 py-3"><span className={`text-xs ${INVOICE_STATUS_COLORS[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span></td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(inv)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(inv.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
