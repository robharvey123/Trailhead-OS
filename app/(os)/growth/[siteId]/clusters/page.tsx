import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoClusters, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { PendingButton } from '@/components/growth/PendingButton'
import { overlapReadiness } from '@/lib/growth/clustering'
import {
  approveClusterAction,
  archiveClusterAction,
  generateBriefAction,
  generateClustersAction,
  generateOverlapClustersAction,
  queueOverlapSnapshotsAction,
} from '../../actions'

const STATUS_STYLE: Record<string, string> = {
  proposed: 'border-amber-300 bg-amber-50 text-amber-700',
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  archived: 'border-[color:var(--border)] text-[color:var(--text-3)]',
}

export default async function GrowthClustersPage({
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
  const clusters = await getSeoClusters(siteId, supabase)
  const readiness = await overlapReadiness(siteId).catch(() => null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
              {site.name}
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">Topic clusters</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Approving a cluster creates a content-programme Project on the existing Gantt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={generateClustersAction.bind(null, site.id)}>
            <PendingButton pendingLabel="Generating clusters…">Cluster by model (fallback)</PendingButton>
          </form>
          {readiness && readiness.missing.length > 0 ? (
            <form action={queueOverlapSnapshotsAction.bind(null, site.id)}>
              <PendingButton pendingLabel="Queueing SERP tasks…">
                Queue {readiness.missing.length - readiness.pending} SERP snapshots
              </PendingButton>
            </form>
          ) : null}
          <form action={generateOverlapClustersAction.bind(null, site.id)}>
            <PendingButton variant="primary" className="px-4 py-3 font-semibold" pendingLabel="Measuring SERP overlap…">
              Cluster by SERP overlap
            </PendingButton>
          </form>
        </div>
      </div>

      {readiness ? (
        <div className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--text-2)]">
          SERP-overlap clustering (measured, not guessed) needs a snapshot per keyword: {readiness.withSnapshot} of {readiness.total} have one
          {readiness.pending > 0 ? `, ${readiness.pending} queued and landing within ~15 minutes` : ''}.
          {readiness.missing.length - readiness.pending > 0
            ? ` Queueing the remaining ${readiness.missing.length - readiness.pending} costs roughly $${((readiness.missing.length - readiness.pending) * 0.0006).toFixed(2)} on the Standard queue.`
            : ''}{' '}
          Keywords without a snapshot are left out of the overlap run, never silently guessed in. Threshold: {site.serp_overlap_threshold} shared top-10 URLs (settings).
        </div>
      ) : null}

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

      {clusters.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No clusters yet. Generate them once the keyword list looks healthy — generic clusters
          mean the site&apos;s ICP and brand voice need sharpening, not the prompt.
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="os-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[color:var(--text)]">{cluster.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-2)]">
                    Pillar: {cluster.pillar_keyword ?? '—'} · {cluster.intent ?? 'no intent'} ·{' '}
                    {cluster.keyword_count} keywords · priority {cluster.priority} ·{' '}
                    <span title={cluster.method === 'serp_overlap' ? 'Membership measured by shared top-10 URLs' : 'Membership guessed by the model from keyword strings'}>
                      {cluster.method === 'serp_overlap' ? 'SERP overlap' : 'model'}
                    </span>
                  </p>
                  {cluster.rationale ? <p className="mt-1 text-sm text-[color:var(--text-3)]">{cluster.rationale}</p> : null}
                  {cluster.evidence?.shared_domains && cluster.evidence.shared_domains.length > 0 ? (
                    <p className="mt-1 text-xs text-[color:var(--text-3)]">
                      Who owns this topic: {cluster.evidence.shared_domains.map((d) => `${d.domain} (${d.count}/${cluster.evidence?.member_count ?? '?'})`).join(' · ')}
                      {cluster.evidence.avg_overlap ? ` · avg ${cluster.evidence.avg_overlap} shared URLs per pair` : ''}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLE[cluster.status] ?? ''}`}
                >
                  {cluster.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {cluster.status === 'proposed' ? (
                  <>
                    <form action={approveClusterAction.bind(null, site.id, cluster.id)}>
                      <PendingButton variant="primary" pendingLabel="Creating project…">
                        Approve → create project
                      </PendingButton>
                    </form>
                    <form action={archiveClusterAction.bind(null, site.id, cluster.id)}>
                      <PendingButton pendingLabel="Archiving…">Archive</PendingButton>
                    </form>
                  </>
                ) : null}
                {cluster.status !== 'archived' ? (
                  <form action={generateBriefAction.bind(null, site.id, cluster.id)}>
                    <PendingButton pendingLabel="Writing brief…">Generate brief</PendingButton>
                  </form>
                ) : null}
                {cluster.project_id ? (
                  <Link
                    href={`/projects/records/${cluster.project_id}`}
                    className="text-sm text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2"
                  >
                    View project
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
