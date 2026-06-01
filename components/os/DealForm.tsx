'use client'

import { useState } from 'react'
import {
  DEAL_STAGES,
  DEAL_SOURCES,
  type DealInput,
  type DealStage,
  type DealWithRelations,
} from '@/lib/types'

interface DealFormProps {
  deal: DealWithRelations | null
  accounts: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (input: DealInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function DealForm({ deal, accounts, onClose, onSave, onDelete }: DealFormProps) {
  const [name, setName] = useState(deal?.name ?? '')
  const [accountId, setAccountId] = useState(deal?.account_id ?? accounts[0]?.id ?? '')
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? 'New')
  const [valueAmount, setValueAmount] = useState(
    deal?.value_amount != null ? String(deal.value_amount) : ''
  )
  const [probability, setProbability] = useState(String(deal?.probability ?? 10))
  const [expectedClose, setExpectedClose] = useState(deal?.expected_close_date ?? '')
  const [source, setSource] = useState(deal?.source ?? '')
  const [notes, setNotes] = useState(deal?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim() || !accountId) {
      setError('Name and account are required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave({
        id: deal?.id,
        account_id: accountId,
        name: name.trim(),
        stage,
        value_amount: valueAmount === '' ? null : Number(valueAmount),
        probability: Number(probability),
        expected_close_date: expectedClose || null,
        source: source || null,
        notes: notes || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#2A2A3A] bg-[#0C0C14] px-3 py-2 text-sm text-white placeholder-[#6B7280] focus:border-[#3A3A4A] focus:outline-none'
  const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[#9CA3AF]'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[#2A2A3A] bg-[#1A1A28] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2A2A3A] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{deal ? 'Edit deal' : 'New deal'}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-white" type="button">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className={labelClass}>Deal name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 listing — DRIVER pouches"
            />
          </div>

          <div>
            <label className={labelClass}>Account</label>
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Stage</label>
              <select
                className={inputClass}
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Probability (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Value (£)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={valueAmount}
                onChange={(e) => setValueAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass}>Expected close</label>
              <input
                type="date"
                className={inputClass}
                value={expectedClose ?? ''}
                onChange={(e) => setExpectedClose(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Source</label>
            <select className={inputClass} value={source ?? ''} onChange={(e) => setSource(e.target.value)}>
              <option value="">—</option>
              {DEAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} min-h-[6rem] resize-y`}
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#2A2A3A] px-6 py-4">
          {deal && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(deal.id)}
              className="text-sm text-rose-300 hover:text-rose-200"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0C0C14] hover:bg-[#E5E7EB] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save deal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
