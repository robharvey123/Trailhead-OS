'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { currencySymbol } from '@/lib/format'
import type { FinanceCreditNote, CreditNoteStatus, InvoiceDirection, InvoiceLineItem } from '@/lib/finance/types'
import { CREDIT_NOTE_STATUSES, CREDIT_NOTE_STATUS_LABELS, CREDIT_NOTE_STATUS_COLORS } from '@/lib/finance/types'

type AccountOption = { id: string; name: string }
type InvoiceOption = { id: string; invoice_number: string }

export default function CreditNotesClient({
  workspaceId, initialCreditNotes, accounts, invoices, baseCurrency, supportedCurrencies,
}: {
  workspaceId: string; initialCreditNotes: FinanceCreditNote[]; accounts: AccountOption[]
  invoices: InvoiceOption[]; baseCurrency: string; supportedCurrencies: string[]
}) {
  const [creditNotes, setCreditNotes] = useState(initialCreditNotes)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Form
  const [cnNumber, setCnNumber] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [direction, setDirection] = useState<InvoiceDirection>('outgoing')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [taxRate, setTaxRate] = useState('0')
  const [currency, setCurrency] = useState(baseCurrency)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))
  const fmtCur = (v: number, code?: string) => `${currencySymbol(code || baseCurrency)}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const resetForm = () => {
    setCnNumber(''); setInvoiceId(''); setAccountId(''); setDirection('outgoing')
    setIssueDate(new Date().toISOString().slice(0, 10)); setTaxRate('0'); setCurrency(baseCurrency)
    setReason(''); setNotes(''); setLineItems([]); setEditingId(null)
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

  const openEdit = (cn: FinanceCreditNote) => {
    setCnNumber(cn.credit_note_number); setInvoiceId(cn.invoice_id || ''); setAccountId(cn.account_id || '')
    setDirection(cn.direction); setIssueDate(cn.issue_date); setTaxRate(cn.tax_rate.toString())
    setCurrency(cn.currency); setReason(cn.reason || ''); setNotes(cn.notes || '')
    setLineItems(cn.line_items || []); setEditingId(cn.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, credit_note_number: cnNumber, invoice_id: invoiceId || null,
        account_id: accountId || null, direction, issue_date: issueDate,
        tax_rate: parseFloat(taxRate), currency, reason: reason || null,
        notes: notes || null, line_items: lineItems,
      }
      if (editingId) {
        const { credit_note } = await apiFetch<{ credit_note: FinanceCreditNote }>(`/api/finance/credit-notes/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setCreditNotes((prev) => prev.map((c) => c.id === editingId ? credit_note : c))
        toast.success('Credit note updated')
      } else {
        const { credit_note } = await apiFetch<{ credit_note: FinanceCreditNote }>('/api/finance/credit-notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setCreditNotes((prev) => [credit_note, ...prev])
        toast.success('Credit note created')
      }
      resetForm(); setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, editingId, cnNumber, invoiceId, accountId, direction, issueDate, taxRate, currency, reason, notes, lineItems])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/finance/credit-notes/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setCreditNotes((prev) => prev.filter((c) => c.id !== id))
      toast.success('Credit note deleted')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete') }
  }, [workspaceId])

  const filtered = useMemo(() => creditNotes.filter((c) => filterStatus === 'all' || c.status === filterStatus), [creditNotes, filterStatus])
  const totals = useMemo(() => ({
    total: filtered.reduce((s, c) => s + c.total, 0),
    issued: filtered.filter((c) => c.status === 'issued').reduce((s, c) => s + c.total, 0),
  }), [filtered])

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxAmount = subtotal * ((parseFloat(taxRate) || 0) / 100)
  const total = subtotal + taxAmount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold">Credit Notes</h1>
          <p className="mt-1 text-sm text-slate-400">Total: {fmtCur(totals.total)} &middot; Issued: {fmtCur(totals.issued)}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Credit Note</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Statuses</option>
          {CREDIT_NOTE_STATUSES.map((s) => <option key={s} value={s}>{CREDIT_NOTE_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Credit Note' : 'New Credit Note'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="block text-xs text-slate-400 mb-1">Credit Note #</label><input value={cnNumber} onChange={(e) => setCnNumber(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Related Invoice</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="">None</option>
                {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Direction</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as InvoiceDirection)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="outgoing">Outgoing</option><option value="incoming">Incoming</option>
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Issue Date</label><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Tax Rate (%)</label><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                {supportedCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-xs text-slate-400 mb-1">Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Line Items</span>
              <button type="button" onClick={addLineItem} className="text-xs text-blue-400 hover:underline">+ Add Line</button>
            </div>
            {lineItems.map((item) => (
              <div key={item.id} className="mb-2 grid grid-cols-12 gap-2 items-center">
                <input value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder="Description" className="col-span-5 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-sm" />
                <input type="number" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-sm text-right" />
                <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-sm text-right" />
                <span className="col-span-2 text-right text-sm">{fmtCur(item.quantity * item.unit_price)}</span>
                <button type="button" onClick={() => removeLineItem(item.id)} className="col-span-1 text-xs text-rose-400">&times;</button>
              </div>
            ))}
            {lineItems.length > 0 && (
              <div className="mt-2 text-right text-sm space-y-1">
                <p className="text-slate-400">Subtotal: {fmtCur(subtotal)}</p>
                {parseFloat(taxRate) > 0 && <p className="text-slate-400">Tax ({taxRate}%): {fmtCur(taxAmount)}</p>}
                <p className="font-semibold">Total: {fmtCur(total)}</p>
              </div>
            )}
          </div>

          <div><label className="block text-xs text-slate-400 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false) }} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs uppercase tracking-wide text-slate-400 hover:text-white">Cancel</button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-16">
          <div className="mb-3 text-4xl text-slate-600">📋</div>
          <p className="text-slate-400">No credit notes yet</p>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="mt-3 text-xs text-blue-400 hover:underline">Create your first credit note</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((cn) => (
                <tr key={cn.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{cn.credit_note_number}</td>
                  <td className="px-4 py-3">{cn.issue_date}</td>
                  <td className="px-4 py-3">{cn.account_id ? accountMap.get(cn.account_id) || '—' : '—'}</td>
                  <td className="px-4 py-3">
                    {cn.invoice_id ? <Link href={`/workspace/${workspaceId}/invoices/${cn.invoice_id}`} className="text-blue-400 hover:underline">{cn.invoice_number || 'View'}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{fmtCur(cn.total, cn.currency)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold uppercase ${CREDIT_NOTE_STATUS_COLORS[cn.status] || 'text-slate-400'}`}>{CREDIT_NOTE_STATUS_LABELS[cn.status] || cn.status}</span></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(cn)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(cn.id)} className="text-xs text-rose-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
