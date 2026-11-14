import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoArticles, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'

const STATUS_STYLE: Record<string, string> = {
  drafting: 'border-[var(--amber)]/40 bg-[var(--amber-dim)] text-[var(--amber-strong)]',
  review: 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  approved: 'border-[var(--emerald)]/40 bg-[var(--emerald-dim)] text-[var(--emerald-strong)]',
  // Amber, like drafting: in flight, not done.
  publishing: 'border-[var(--amber)]/40 bg-[var(--amber-dim)] text-[var(--amber-strong)]',
  published: 'border-[var(--emerald)] bg-[var(--emerald-dim)] text-[var(--emerald-strong)]',
  archived: 'border-[color:var(--border)] text-[color:var(--text-3)]',
}

export default async function GrowthArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ notice?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()
  const articles = await getSeoArticles(siteId, supabase)

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">
          <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
            {site.name}
          </Link>
        </p>
        <h1 className="mt-2 os-page-title">Articles</h1>
      </div>

      {resolved?.notice ? (
        <div className="rounded-card border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}

      {articles.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          Nothing drafted yet — approve a brief to queue the first article.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/growth/${site.id}/articles/${article.id}`}
              className="os-card block p-5 transition hover:border-[color:var(--accent)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[color:var(--text)]">{article.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-2)]">
                    {article.word_count ? `${article.word_count.toLocaleString('en-GB')} words · ` : ''}
                    {article.token_cost ? `~$${article.token_cost.toFixed(2)} tokens · ` : ''}
                    {new Date(article.created_at).toLocaleDateString('en-GB')}
                  </p>
                  {article.error ? (
                    <p className="mt-1 text-sm text-[var(--red-strong)]">Draft failed: {article.error}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-pill border px-3 py-1 text-xs font-medium ${STATUS_STYLE[article.status] ?? ''}`}
                >
                  {article.status === 'drafting' && !article.error ? 'drafting…' : article.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
