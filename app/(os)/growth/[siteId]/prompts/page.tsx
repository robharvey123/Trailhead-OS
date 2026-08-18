import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import type { SeoPrompt } from '@/lib/types'
import { PendingButton } from '@/components/growth/PendingButton'
import { addPromptAction, seedPromptsAction, togglePromptAction } from '../../actions'

const INPUT_CLASS =
  'rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'

export default async function GrowthPromptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()

  const { data } = await supabase
    .from('seo_prompts')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true })
  const prompts = (data ?? []) as SeoPrompt[]
  const active = prompts.filter((p) => p.active).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
              {site.name}
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">AI visibility prompts</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {active} active — each runs weekly against every configured provider (Anthropic
            always; OpenAI/Perplexity once their keys are set).
          </p>
        </div>
        <form action={seedPromptsAction.bind(null, site.id)}>
          <PendingButton variant="primary" pendingLabel="Writing prompts… (~30s)">
            Generate from ICP
          </PendingButton>
        </form>
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}

      <form
        action={addPromptAction.bind(null, site.id)}
        className="os-card flex flex-wrap items-center gap-3 p-5"
      >
        <input
          name="prompt"
          required
          placeholder="best job management software for UK fire and security engineers"
          className={`min-w-64 grow ${INPUT_CLASS}`}
        />
        <input name="category" placeholder="category (optional)" className={`w-40 ${INPUT_CLASS}`} />
        <button
          type="submit"
          className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
        >
          Add
        </button>
      </form>

      {prompts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No prompts yet — generate a starter set from the site&apos;s ICP.
        </div>
      ) : (
        <div className="os-card divide-y divide-[color:var(--border)] p-2">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className={`text-sm ${prompt.active ? 'text-[color:var(--text)]' : 'text-[color:var(--text-3)] line-through'}`}>
                  {prompt.prompt}
                </p>
                {prompt.category ? (
                  <p className="text-xs text-[color:var(--text-3)]">{prompt.category}</p>
                ) : null}
              </div>
              <form action={togglePromptAction.bind(null, site.id, prompt.id, !prompt.active)}>
                <button
                  type="submit"
                  className="shrink-0 rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
                >
                  {prompt.active ? 'Deactivate' : 'Activate'}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
