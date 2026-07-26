import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listAudiences } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'
import { createCampaign } from '../[id]/actions'

export const metadata = { title: 'New campaign | Trailhead OS' }

export default async function NewCampaignPage() {
  const supabase = await createClient()
  const audiences = await listAudiences(supabase).catch(() => [])
  const input = 'os-input w-full rounded-2xl px-4 py-3 text-sm'

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">New campaign</h1>
          <p className="text-sm text-[var(--muted)]">Creates a draft — add steps and start it from the campaign page.</p>
        </div>

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
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm">Create draft</button>
          </div>
        </form>
      </div>
    </div>
  )
}
