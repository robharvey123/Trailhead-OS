import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listTemplates } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'

export const metadata = { title: 'Templates | Trailhead OS' }

export default async function TemplatesPage() {
  const supabase = await createClient()
  const templates = await listTemplates(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Templates</h1>
          <p className="text-sm text-[var(--muted)]">
            Merge tags: {'{{email_greeting}}, {{company}}, {{name}}, {{city}}, {{channel}}, {{sub_trade}}, {{size_signal}}'}.
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="empty">No templates yet. The Engineer OS seed creates four.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Subject</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}><td className="td-name">{t.name}</td><td className="td-sub">{t.subject || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
