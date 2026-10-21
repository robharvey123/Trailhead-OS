'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import OutcomeLogger from '@/components/sales/OutcomeLogger'
import { claimContact, setEngineerOsOrgId, setStage } from '../../actions'
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from '@/lib/sales/queue'

export default function PipelinePanel({
  contactId,
  stage,
  ownerIsMe,
  ownedByOther,
  nextActionAt,
  nextActionNote,
  lostReason,
  disqualifiedReason,
  recontactAfter,
  orgId,
}: {
  contactId: string
  stage: PipelineStage
  ownerIsMe: boolean
  ownedByOther: boolean
  nextActionAt: string | null
  nextActionNote: string | null
  lostReason: string | null
  disqualifiedReason: string | null
  recontactAfter: string | null
  orgId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState<PipelineStage>(stage)
  const [reason, setReason] = useState('')
  const [org, setOrg] = useState(orgId ?? '')

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  const needsReason = moveTo === 'lost' || moveTo === 'disqualified'
  const input = 'rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className={label}>Stage</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Stage" className={input} value={moveTo} onChange={(e) => setMoveTo(e.target.value as PipelineStage)}>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            {moveTo !== stage ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={pending || (needsReason && !reason.trim())} onClick={() => run(() => setStage(contactId, moveTo, reason))}>
                Move
              </button>
            ) : null}
          </div>
          {moveTo !== stage && needsReason ? (
            <input aria-label="Reason" className={`${input} mt-2 w-full`} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          ) : null}
          {stage === 'lost' && lostReason ? <p className="mt-2 text-xs text-[color:var(--text-2)]">Lost: {lostReason}{recontactAfter ? `. Recontact after ${new Date(recontactAfter).toLocaleDateString('en-GB')}` : ''}</p> : null}
          {stage === 'disqualified' && disqualifiedReason ? <p className="mt-2 text-xs text-[color:var(--text-2)]">Disqualified: {disqualifiedReason}</p> : null}
        </div>
        <div>
          <p className={label}>Owner</p>
          {ownerIsMe ? (
            <div className="flex items-center gap-2 text-sm">You <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => claimContact(contactId, false))}>Release</button></div>
          ) : ownedByOther ? (
            <p className="text-sm text-[color:var(--text-2)]">Someone else</p>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => claimContact(contactId, true))}>Claim this contact</button>
          )}
          <p className={`${label} mt-3`}>Next action</p>
          <p className="text-sm">{nextActionAt ? new Date(nextActionAt).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'None'}</p>
          {nextActionNote ? <p className="text-xs text-[color:var(--text-2)]">{nextActionNote}</p> : null}
        </div>
        <div>
          <label className={label} htmlFor="eos-org">Engineer OS org</label>
          <div className="flex items-center gap-2">
            <input id="eos-org" className={`${input} w-full`} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="tenant slug once trialling" />
            {org !== (orgId ?? '') ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setEngineerOsOrgId(contactId, org))}>Save</button> : null}
          </div>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-[color:var(--red)]">{error}</p> : null}
      <div className="border-t border-[var(--border)] pt-4">
        <p className={label}>Log an outcome</p>
        <OutcomeLogger contactId={contactId} onLogged={() => router.refresh()} />
      </div>
    </div>
  )
}
