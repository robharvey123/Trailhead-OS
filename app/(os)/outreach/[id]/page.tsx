import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCampaign, listCampaignSteps, listRecipients } from '@/lib/db/outreach'
import { OUTREACH_CAMPAIGN_STATUS_LABELS, OUTREACH_RECIPIENT_STATUSES, OUTREACH_RECIPIENT_STATUS_LABELS, type OutreachRecipientStatus } from '@/lib/types'
import { mockupFontVars } from '@/lib/fonts'
import { startCampaignAction, pauseCampaignAction, resumeCampaignAction, cancelCampaignAction } from './actions'

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

export default async function CampaignDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ status?: string }>
}) {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const statusFilter = OUTREACH_RECIPIENT_STATUSES.includes(sp?.status as OutreachRecipientStatus) ? (sp!.status as OutreachRecipientStatus) : undefined

  const supabase = await createClient()
  const campaign = await getCampaign(id, supabase).catch(() => null)
  if (!campaign) notFound()
  const [steps, recipients] = await Promise.all([
    listCampaignSteps(id, supabase).catch(() => []),
    listRecipients(id, { status: statusFilter }, supabase).catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">{campaign.name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {campaign.from_name} &lt;{campaign.from_email}&gt; · reply-to {campaign.reply_to ?? '—'} · cap {campaign.daily_send_cap}/day ·
                {' '}{campaign.send_window_start}–{campaign.send_window_end} {campaign.timezone}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="meta-chip">{OUTREACH_CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
              {campaign.status === 'draft' ? (
                <form action={startCampaignAction}><input type="hidden" name="id" value={campaign.id} /><button className="btn btn-primary btn-sm">Start</button></form>
              ) : null}
              {campaign.status === 'running' ? (
                <form action={pauseCampaignAction}><input type="hidden" name="id" value={campaign.id} /><button className="btn btn-ghost btn-sm">Pause</button></form>
              ) : null}
              {campaign.status === 'paused' ? (
                <form action={resumeCampaignAction}><input type="hidden" name="id" value={campaign.id} /><button className="btn btn-primary btn-sm">Resume</button></form>
              ) : null}
              {campaign.status !== 'completed' && campaign.status !== 'cancelled' ? (
                <form action={cancelCampaignAction}><input type="hidden" name="id" value={campaign.id} /><button className="btn btn-ghost btn-sm">Cancel</button></form>
              ) : null}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="os-card rounded-[2rem] p-6">
          <h2 className="text-lg font-semibold text-white">Sequence</h2>
          {steps.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No steps yet.</p>
          ) : (
            <table className="data-table mt-3">
              <thead><tr><th>Step</th><th>Template</th><th style={{ textAlign: 'right' }}>Delay (days)</th></tr></thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.id}><td className="td-mono">{s.step_number}</td><td>{s.template_name ?? '—'}</td><td style={{ textAlign: 'right' }} className="td-mono">{s.delay_days}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recipients */}
        <div className="os-card rounded-[2rem] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Recipients ({campaign.stats?.recipients ?? recipients.length})</h2>
            <div className="flex flex-wrap gap-1">
              <Link href={`/outreach/${id}`} className={`btn btn-ghost btn-sm ${!statusFilter ? 'active' : ''}`}>All</Link>
              {OUTREACH_RECIPIENT_STATUSES.map((s) => (
                <Link key={s} href={`/outreach/${id}?status=${s}`} className={`btn btn-ghost btn-sm ${statusFilter === s ? 'active' : ''}`}>
                  {OUTREACH_RECIPIENT_STATUS_LABELS[s]}
                </Link>
              ))}
            </div>
          </div>
          {recipients.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No recipients{statusFilter ? ` with status ${statusFilter}` : ''}.</p>
          ) : (
            <table className="data-table mt-3">
              <thead>
                <tr><th>Contact</th><th>Company</th><th>Status</th><th style={{ textAlign: 'right' }}>Step</th><th>Next send</th><th>Stopped</th></tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="td-name">{r.contact?.name ?? '—'}<div className="td-sub">{r.contact?.email}</div></td>
                    <td>{r.contact?.company ?? '—'}</td>
                    <td><span className="meta-chip">{OUTREACH_RECIPIENT_STATUS_LABELS[r.status]}</span></td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{r.current_step}</td>
                    <td className="td-mono">{fmt(r.next_send_at)}</td>
                    <td>{r.stopped_reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
