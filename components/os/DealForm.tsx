'use client'

import { useId, useState } from 'react'
import {
  DEAL_STAGES,
  DEAL_SOURCES,
  type DealInput,
  type DealStage,
  type DealWithRelations,
} from '@/lib/types'
import Modal from '@/components/ui/Modal'
import AccountCombobox from './AccountCombobox'
import ProjectMultiSelect from './ProjectMultiSelect'

interface DealFormProps {
  deal: DealWithRelations | null
  accounts: Array<{ id: string; name: string }>
  contacts?: Array<{ id: string; name: string }>
  projects?: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (input: DealInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function DealForm({
  deal,
  accounts,
  contacts = [],
  projects = [],
  onClose,
  onSave,
  onDelete,
}: DealFormProps) {
  const [name, setName] = useState(deal?.name ?? '')
  const [accountId, setAccountId] = useState(deal?.account_id ?? accounts[0]?.id ?? '')
  const [accountName, setAccountName] = useState(
    deal?.account?.name ?? accounts.find((a) => a.id === (deal?.account_id ?? accounts[0]?.id))?.name ?? ''
  )
  const [projectIds, setProjectIds] = useState<string[]>(deal?.projects?.map((p) => p.id) ?? [])
  const [primaryContactId, setPrimaryContactId] = useState(deal?.primary_contact_id ?? '')
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
  const errorId = useId()

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
        primary_contact_id: primaryContactId || null,
        name: name.trim(),
        stage,
        value_amount: valueAmount === '' ? null : Number(valueAmount),
        probability: Number(probability),
        expected_close_date: expectedClose || null,
        source: source || null,
        notes: notes || null,
        project_ids: projectIds,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)] placeholder-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'
  const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'

  return (
    <Modal
      open
      onClose={onClose}
      title={deal ? 'Edit deal' : 'New deal'}
      placement="right"
      closeLabel="Close deal panel"
      panelClassName="flex h-full w-full max-w-md flex-col border-l border-[color:var(--border)] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-4">
        <h2 className="text-lg font-semibold text-[color:var(--text)]">{deal ? 'Edit deal' : 'New deal'}</h2>
        <button
          onClick={onClose}
          aria-label="Close deal panel"
          className="text-[color:var(--text-2)] hover:text-[color:var(--text)]"
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className={labelClass}>Deal name</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 listing — DRIVER pouches"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>

        <AccountCombobox
          label="Account"
          value={accountId}
          selectedName={accountName}
          onChange={(account) => {
            setAccountId(account.id)
            setAccountName(account.name)
          }}
        />

        <ProjectMultiSelect
          label="Projects"
          options={projects}
          value={projectIds}
          onChange={setProjectIds}
        />

        {contacts.length > 0 ? (
          <label className="block">
            <span className={labelClass}>Primary contact</span>
            <select
              className={inputClass}
              value={primaryContactId ?? ''}
              onChange={(e) => setPrimaryContactId(e.target.value)}
            >
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Stage</span>
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
          </label>
          <label className="block">
            <span className={labelClass}>Probability (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Value (£)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={valueAmount}
              onChange={(e) => setValueAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Expected close</span>
            <input
              type="date"
              className={inputClass}
              value={expectedClose ?? ''}
              onChange={(e) => setExpectedClose(e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Source</span>
          <select className={inputClass} value={source ?? ''} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {DEAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Notes</span>
          <textarea
            className={`${inputClass} min-h-[6rem] resize-y`}
            value={notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error ? (
          <p id={errorId} role="alert" className="text-sm text-[color:var(--red-strong)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] px-6 py-4">
        {deal && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(deal.id)}
            className="text-sm text-[color:var(--red-strong)] hover:text-[color:var(--red)]"
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
            className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[color:var(--text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save deal'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
