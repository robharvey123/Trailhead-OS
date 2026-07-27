import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listAudiences } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'
import { createCampaign } from '../[id]/actions'

export const metadata = { title: 'New campaign | Trailhead OS' }

const WEEKDAYS: Array<{ n: number; label: string }> = [
  { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' }, { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' }, { n: 7, label: 'Sun' },
]

export default async function NewCampaignPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const audiences = await listAudiences(supabase).catch(() => [])
  const error = (searchParams ? await searchParams : undefined)?.error ?? null
  const input = 'os-input w-full rounded-2xl px-4 py-3 text-sm'

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">New campaign</h1>
          <p className="text-sm text-[var(--muted)]">Creates a draft — add steps and start it from the campaign page.</p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] p-4 text-sm text-[color:var(--red-strong)]">⚠ {error}</div>
        ) : null}

        <form action={createCampaign} className="os-card space-y-4 rounded-[2rem] p-6">
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <input name="name" required className={input} placeholder="Engineer OS cold outreach" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Audience</span>
            <select name="audience_id" className={input} defaultValue="">
              <option value="">— none —</option>
              {audiences.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.member_count})</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">From name</span>
              <input name="from_name" className={input} defaultValue="Rob Harvey" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Daily cap</span>
              <input name="daily_send_cap" type="number" min={1} className={input} defaultValue={15} />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">From email</span>
            <input name="from_email" type="email" className={input} placeholder="hello@mail.engineeros.uk" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[var(--muted)]">Reply-to</span>
            <input name="reply_to" type="email" className={input} placeholder="rob@trailheadholdings.uk" />
          </label>

          <div className="space-y-2 text-sm">
            <span className="text-[var(--muted)]">Send days</span>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((d) => (
                <label key={d.n} className="flex items-center gap-1.5 text-[var(--muted)]">
                  <input type="checkbox" name="send_days" value={d.n} defaultChecked={[2, 3, 4].includes(d.n)} />
                  {d.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">The scheduler skips any day not ticked. Default Tue to Thu.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Window start</span>
              <input name="send_window_start" type="time" className={input} defaultValue="07:30" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Window end</span>
              <input name="send_window_end" type="time" className={input} defaultValue="16:00" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--muted)]">Timezone</span>
              <input name="timezone" className={input} defaultValue="Europe/London" />
            </label>
          </div>

          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm">Create draft</button>
          </div>
        </form>
      </div>
    </div>
  )
}
