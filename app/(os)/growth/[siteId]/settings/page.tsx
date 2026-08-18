import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById } from '@/lib/db/growth'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import { updateSeoSiteAction } from '../../actions'

const INPUT_CLASS =
  'w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

export default async function GrowthSiteSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()

  const [accounts, workstreams] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])
  const updateAction = updateSeoSiteAction.bind(null, site.id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="os-eyebrow">
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        </p>
        <h1 className="mt-2 os-page-title">Site settings</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          {site.domain} — the ICP and brand voice feed every cluster, brief and draft. If clusters
          come back generic, sharpen these before touching prompts.
        </p>
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      ) : null}

      <form action={updateAction} className="os-card space-y-4 p-6">
        <label className="block text-sm">
          <span className="text-[color:var(--text-2)]">Name</span>
          <input name="name" required defaultValue={site.name} className={`mt-1.5 ${INPUT_CLASS}`} />
        </label>
        <label className="block text-sm">
          <span className="text-[color:var(--text-2)]">Search Console property</span>
          <input
            name="gsc_property"
            defaultValue={site.gsc_property ?? ''}
            placeholder="sc-domain:engineeros.uk"
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[color:var(--text-2)]">Workstream</span>
          <select
            name="workstream_id"
            defaultValue={site.workstream_id ?? ''}
            className={`mt-1.5 ${INPUT_CLASS}`}
          >
            <option value="">None</option>
            {workstreams.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[color:var(--text-2)]">
            Ideal customer profile — who should find this site?
          </span>
          <textarea
            name="icp"
            rows={3}
            defaultValue={site.icp ?? ''}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[color:var(--text-2)]">Brand voice</span>
          <textarea
            name="brand_voice"
            rows={3}
            defaultValue={site.brand_voice ?? ''}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <fieldset className="rounded-2xl border border-[color:var(--border)] p-4">
          <legend className="px-1 text-sm font-semibold text-[color:var(--text)]">Publishing</legend>
          <label className="block text-sm">
            <span className="text-[color:var(--text-2)]">CMS</span>
            <select name="cms_type" defaultValue={site.cms_type} className={`mt-1.5 ${INPUT_CLASS}`}>
              <option value="none">None (publishing disabled)</option>
              <option value="internal">Trailhead marketing blog — draft in /blog</option>
              <option value="github">GitHub — PR to a separate site repo</option>
              <option value="wordpress">WordPress — create drafts via REST</option>
            </select>
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">GitHub repo (owner/name)</span>
              <input
                name="cms_repo"
                defaultValue={String((site.cms_config as { repo?: string }).repo ?? '')}
                placeholder="robharvey/engineeros-site"
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">Base branch</span>
              <input
                name="cms_base_branch"
                defaultValue={String((site.cms_config as { base_branch?: string }).base_branch ?? 'main')}
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">Content directory</span>
              <input
                name="cms_content_dir"
                defaultValue={String((site.cms_config as { content_dir?: string }).content_dir ?? 'content/blog')}
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">Frontmatter author</span>
              <input
                name="cms_author"
                defaultValue={String((site.cms_config as { author?: string }).author ?? '')}
                placeholder="Rob Harvey"
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">WordPress base URL</span>
              <input
                name="cms_base_url"
                defaultValue={String((site.cms_config as { base_url?: string }).base_url ?? '')}
                placeholder="https://client-site.co.uk"
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">WP username</span>
              <input
                name="cms_username"
                defaultValue={String((site.cms_config as { username?: string }).username ?? '')}
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[color:var(--text-2)]">WP application password</span>
              <input
                name="cms_app_password"
                type="password"
                placeholder={
                  (site.cms_config as { app_password?: string }).app_password
                    ? 'saved — leave blank to keep'
                    : ''
                }
                className={`mt-1.5 ${INPUT_CLASS}`}
              />
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-[color:var(--text-2)]">
            <input
              type="checkbox"
              name="is_client"
              defaultChecked={site.is_client}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Client site
          </label>
          <label className="block grow text-sm">
            <span className="text-[color:var(--text-2)]">CRM account (required for client sites)</span>
            <select
              name="client_account_id"
              defaultValue={site.client_account_id ?? ''}
              className={`mt-1.5 ${INPUT_CLASS}`}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Save settings
        </button>
      </form>
    </div>
  )
}
