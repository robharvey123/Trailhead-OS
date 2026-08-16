import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCampaign, listCampaignSteps, listRecipients, listTemplates, listAudienceContacts } from '@/lib/db/outreach'
import { OUTREACH_CAMPAIGN_STATUS_LABELS, OUTREACH_RECIPIENT_STATUSES, OUTREACH_RECIPIENT_STATUS_LABELS, type OutreachRecipientStatus } from '@/lib/types'
import { mockupFontVars } from '@/lib/fonts'
import {
  startCampaignAction, pauseCampaignAction, resumeCampaignAction, cancelCampaignAction,
  updateCampaignScheduleAction, addCampaignStepAction, removeCampaignStepAction, sendTestEmailAction,
} from './actions'

const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }
const WEEKDAYS: Array<{ n: number; label: string }> = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, label: WEEKDAY_LABELS[n] }))

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

/** 'HH:MM:SS' (Postgres time) → 'HH:MM'. */
function hm(t: string | null) {
  return (t ?? '').slice(0, 5)
}

function scheduleLabel(days: number[], start: string, end: string, tz: string) {
  const dayText = days.length ? days.map((d) => WEEKDAY_LABELS[d] ?? d).join(', ') : 'no days'
  return `${dayText} · ${hm(start)} to ${hm(end)} ${tz}`
}

export default async function CampaignDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ status?: string; error?: string; test?: string }>
}) {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const statusFilter = OUTREACH_RECIPIENT_STATUSES.includes(sp?.status as OutreachRecipientStatus) ? (sp!.status as OutreachRecipientStatus) : undefined
  const errorMsg = sp?.error ?? null
  const testSentTo = sp?.test ?? null

  const supabase = await createClient()
  const campaign = await getCampaign(id, supabase).catch(() => null)
  if (!campaign) notFound()
  const [steps, recipients, templates, audienceContacts, { data: userData }] = await Promise.all([
    listCampaignSteps(id, supabase).catch(() => []),
    listRecipients(id, { status: statusFilter }, supabase).catch(() => []),
    listTemplates(supabase).catch(() => []),
    campaign.audience_id ? listAudienceContacts(campaign.audience_id, supabase).catch(() => []) : Promise.resolve([]),
    supabase.auth.getUser(),
  ])
  const isRunning = campaign.status === 'running'
  const userEmail = userData?.user?.email ?? ''
  const input = 'os-input rounded-xl px-3 py-2 text-sm'

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">{campaign.name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {campaign.from_name} &lt;{campaign.from_email}&gt; · reply-to {campaign.reply_to ?? '—'} · cap {campaign.daily_send_cap}/day
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">🗓 {scheduleLabel(campaign.send_days, campaign.send_window_start, campaign.send_window_end, campaign.timezone)}</p>
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

        {errorMsg ? (
          <div className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] p-4 text-sm text-[color:var(--red-strong)]">⚠ {errorMsg}</div>
        ) : null}
        {testSentTo ? (
          <div className="rounded-2xl border border-[color:var(--green)] bg-[var(--green-dim)] p-4 text-sm text-[color:var(--green-strong)]">✓ Test email sent to {testSentTo}.</div>
        ) : null}

        {/* Schedule editor */}
        <div className="os-card rounded-[2rem] p-6">
          <h2 className="text-lg font-semibold text-white">Schedule</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Editable any time — a change takes effect on the next tick, no pause needed.</p>
          <form action={updateCampaignScheduleAction} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={campaign.id} />
            <div className="flex flex-wrap gap-3 text-sm">
              {WEEKDAYS.map((d) => (
                <label key={d.n} className="flex items-center gap-1.5 text-[var(--muted)]">
                  <input type="checkbox" name="send_days" value={d.n} defaultChecked={campaign.send_days.includes(d.n)} />
                  {d.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                <span className="block text-[var(--muted)]">Start</span>
                <input name="send_window_start" type="time" className={input} defaultValue={hm(campaign.send_window_start)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-[var(--muted)]">End</span>
                <input name="send_window_end" type="time" className={input} defaultValue={hm(campaign.send_window_end)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-[var(--muted)]">Timezone</span>
                <input name="timezone" className={input} defaultValue={campaign.timezone} />
              </label>
              <button className="btn btn-ghost btn-sm">Save schedule</button>
            </div>
          </form>
        </div>

        {/* Steps */}
        <div className="os-card rounded-[2rem] p-6">
          <h2 className="text-lg font-semibold text-white">Sequence</h2>
          {isRunning ? (
            <p className="mt-1 text-sm text-[color:var(--amber-strong)]">Steps are locked while the campaign is running — recipients hold a step position that would shift onto the wrong email. Pause to edit.</p>
          ) : null}
          {steps.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No steps yet. Add the first-touch email below — a campaign with zero steps can’t start.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="data-table mt-3">
              <thead><tr><th>Step</th><th>Template</th><th style={{ textAlign: 'right' }}>Delay (days)</th><th></th></tr></thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.id}>
                    <td className="td-mono">{s.step_number}</td>
                    <td>{s.template_name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{s.delay_days}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!isRunning ? (
                        <form action={removeCampaignStepAction}>
                          <input type="hidden" name="id" value={campaign.id} />
                          <input type="hidden" name="step_id" value={s.id} />
                          <button className="btn btn-ghost btn-sm">Remove</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {!isRunning ? (
            <form action={addCampaignStepAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={campaign.id} />
              <label className="space-y-1 text-sm">
                <span className="block text-[var(--muted)]">Template</span>
                <select name="template_id" className={input} defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-[var(--muted)]">Delay (days after previous)</span>
                <input name="delay_days" type="number" min={0} defaultValue={steps.length === 0 ? 0 : 3} className={input} style={{ width: 90 }} />
              </label>
              <button className="btn btn-primary btn-sm">Add step</button>
            </form>
          ) : null}
        </div>

        {/* Send test */}
        <div className="os-card rounded-[2rem] p-6">
          <h2 className="text-lg font-semibold text-white">Send test</h2>
          {steps.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Add a step first — there’s nothing to render yet.</p>
          ) : audienceContacts.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">This campaign’s audience has no contacts with an email, so there’s no sample to render the per-channel template against.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--muted)]">Renders exactly like a real send (subject prefixed <code>[TEST]</code>), including the per-channel override for the chosen contact. Writes nothing — no recipient, no send row, no effect on stats or the cap.</p>
              <form action={sendTestEmailAction} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={campaign.id} />
                <label className="space-y-1 text-sm">
                  <span className="block text-[var(--muted)]">To</span>
                  <input name="to_email" type="email" required defaultValue={userEmail} className={input} style={{ minWidth: 220 }} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-[var(--muted)]">As contact</span>
                  <select name="contact_id" className={input} defaultValue={audienceContacts[0]?.id}>
                    {audienceContacts.map((c) => (
                      <option key={c.id} value={c.id}>{(c.company ?? c.name)}{c.channel ? ` · ${c.channel}` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-[var(--muted)]">Step</span>
                  <select name="step_number" className={input} defaultValue={steps[0]?.step_number}>
                    {steps.map((s) => <option key={s.id} value={s.step_number}>{s.step_number}. {s.template_name ?? '—'}</option>)}
                  </select>
                </label>
                <button className="btn btn-ghost btn-sm">Send test</button>
              </form>
            </>
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
            <div className="overflow-x-auto">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
