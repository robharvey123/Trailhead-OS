import { createClient } from '@/lib/supabase/server'
import { listTemplates } from '@/lib/db/outreach'
import { renderTemplate } from '@/lib/outreach/render'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'
import SafeEmailHtml from '@/components/os/SafeEmailHtml'

export const metadata = { title: 'Templates' }

// A realistic sample contact so the preview reads like a real send.
const SAMPLE: Record<string, string> = {
  email_greeting: 'Ian', company: 'Apex Electrical', name: 'Ian Turner', city: 'Derby',
  channel: 'Electrical, plumbing & HVAC', sub_trade: 'Commercial electrical', size_signal: '~12 engineers',
}

function preview(html: string): { ok: true; html: string } | { ok: false; error: string } {
  try {
    return { ok: true, html: renderTemplate(html, SAMPLE) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid template' }
  }
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const templates = await listTemplates(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/outreach', label: 'Outreach' }}
          title="Templates"
          description={
            <>
              Merge tags: {'{{email_greeting}}, {{company}}, {{name}}, {{city}}, {{channel}}, {{sub_trade}}, {{size_signal}}'}.
            </>
          }
        />

        {templates.length === 0 ? (
          <div className="empty">No templates yet. The Engineer OS seed creates four.</div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const p = preview(t.body_html ?? '')
              const placeholder = (t.body_html ?? '').includes('[Replace') || (t.subject ?? '').includes('[Replace')
              return (
                <div key={t.id} className="os-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text)]">{t.name}</p>
                    {placeholder ? <span className="tag-chip amber">Placeholder copy</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-2)]">Subject: {t.subject || '—'}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-[var(--text-2)]">Preview (sample contact)</summary>
                    <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)]">
                      {p.ok ? <SafeEmailHtml html={p.html} /> : <span className="text-[color:var(--red-strong)]">{p.error}</span>}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
