import Link from 'next/link'
import { getSeoSites } from '@/lib/db/growth'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import { createSeoSiteAction } from './actions'

const INPUT_CLASS =
  'w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

export default async function GrowthPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [sites, accounts, workstreams] = await Promise.all([
    getSeoSites(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">Growth</p>
        <h1 className="mt-2 os-page-title">Growth engine</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Keyword research, content pipeline and search visibility per site.
        </p>
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/growth/${site.id}`}
            className="os-card block p-6 transition hover:border-[color:var(--accent)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[color:var(--text)]">{site.name}</p>
                <p className="mt-1 text-sm text-[color:var(--text-2)]">{site.domain}</p>
              </div>
              {site.is_client ? (
                <span className="rounded-full border border-[color:var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
                  Client{site.account_name ? ` · ${site.account_name}` : ''}
                </span>
              ) : (
                <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-2)]">
                  Internal
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[color:var(--text-2)]">
              <span>{site.keyword_count} keywords</span>
              <span>
                {site.last_gsc_sync_at
                  ? `GSC synced ${new Date(site.last_gsc_sync_at).toLocaleDateString('en-GB')}`
                  : site.gsc_property
                    ? 'GSC not synced yet'
                    : 'No GSC property'}
              </span>
            </div>
          </Link>
        ))}
        {sites.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)] md:col-span-2">
            No sites yet — add engineeros.uk below to start the engine.
          </div>
        ) : null}
      </div>

      <details className="os-card p-6" open={sites.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
          Add a site
        </summary>
        <form action={createSeoSiteAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[color:var(--text-2)]">Name</span>
            <input name="name" required placeholder="Engineer OS" className={`mt-1.5 ${INPUT_CLASS}`} />
          </label>
          <label className="block text-sm">
            <span className="text-[color:var(--text-2)]">Domain</span>
            <input name="domain" required placeholder="engineeros.uk" className={`mt-1.5 ${INPUT_CLASS}`} />
          </label>
          <label className="block text-sm">
            <span className="text-[color:var(--text-2)]">Search Console property</span>
            <input
              name="gsc_property"
              placeholder="sc-domain:engineeros.uk"
              className={`mt-1.5 ${INPUT_CLASS}`}
            />
            <span className="mt-1 block text-xs text-[color:var(--text-3)]">
              `sc-domain:example.uk` for a domain property, or the full URL for a URL-prefix property.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-[color:var(--text-2)]">Workstream</span>
            <select name="workstream_id" defaultValue="" className={`mt-1.5 ${INPUT_CLASS}`}>
              <option value="">None</option>
              {workstreams.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-[color:var(--text-2)]">
              Ideal customer profile — who should find this site?
            </span>
            <textarea
              name="icp"
              rows={2}
              placeholder="UK fire & security / electrical contractors, 5-30 engineers, currently on paper or JobLogic…"
              className={`mt-1.5 ${INPUT_CLASS}`}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-[color:var(--text-2)]">Brand voice</span>
            <textarea
              name="brand_voice"
              rows={2}
              placeholder="Plain-spoken, practical, British English, no hype…"
              className={`mt-1.5 ${INPUT_CLASS}`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-4 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-[color:var(--text-2)]">
              <input type="checkbox" name="is_client" className="h-4 w-4 accent-[var(--accent)]" />
              Client site
            </label>
            <label className="block grow text-sm">
              <span className="text-[color:var(--text-2)]">CRM account (required for client sites)</span>
              <select name="client_account_id" defaultValue="" className={`mt-1.5 ${INPUT_CLASS}`}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Add site
            </button>
          </div>
        </form>
      </details>
    </div>
  )
}
