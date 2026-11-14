import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import type { SeoPrompt } from '@/lib/types'
import { PendingButton } from '@/components/growth/PendingButton'
import { addPromptAction, seedPromptsAction, togglePromptAction } from '../../actions'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'AI visibility prompts' }

const INPUT_CLASS = 'os-input px-3 py-2 text-sm'

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
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        }
        title="AI visibility prompts"
        description={
          <>
            {active} active — each runs weekly against every configured provider (Anthropic
            always; OpenAI/Perplexity once their keys are set).
          </>
        }
        actions={
          <form action={seedPromptsAction.bind(null, site.id)}>
            <PendingButton variant="primary" pendingLabel="Writing prompts… (~30s)">
              Generate from ICP
            </PendingButton>
          </form>
        }
      />

      {resolved?.error ? (
        <div className="rounded-card border border-[var(--red)]/40 bg-[var(--red-dim)] px-4 py-3 text-sm text-[var(--red-strong)]">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-card border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
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
          className="btn btn-ghost"
        >
          Add
        </button>
      </form>

      {prompts.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
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
                  className="btn btn-ghost btn-sm shrink-0"
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
