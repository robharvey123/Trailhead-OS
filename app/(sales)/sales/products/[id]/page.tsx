import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Product | Sales | Trailhead OS' }

/** Read-only product context, via the sales_products/_phases/_milestones views (safe columns only). */
export default async function SalesProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: product }, { data: phases }, { data: milestones }] = await Promise.all([
    supabase.from('sales_products').select('*').eq('id', id).maybeSingle(),
    supabase.from('sales_product_phases').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('sales_product_milestones').select('*').eq('project_id', id).order('due_date', { ascending: true, nullsFirst: false }),
  ])
  if (!product) notFound()

  const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales/dashboard" className="text-sm text-[color:var(--text-2)] hover:underline">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-sm capitalize text-[color:var(--text-2)]">{product.status}</p>
        {product.description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-[color:var(--text-2)]">{product.description}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Phases</h2>
          {(phases ?? []).length === 0 ? <p className="mt-3 text-sm text-[color:var(--text-3)]">None yet.</p> : (
            <ol className="mt-3 space-y-2 text-sm">
              {(phases ?? []).map((ph) => (
                <li key={ph.id}>
                  <span className="font-medium">{ph.name}</span>
                  {ph.start_date || ph.end_date ? <span className="ml-2 text-xs text-[color:var(--text-3)]">{fmt(ph.start_date)} to {fmt(ph.end_date)}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Milestones</h2>
          {(milestones ?? []).length === 0 ? <p className="mt-3 text-sm text-[color:var(--text-3)]">None yet.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {(milestones ?? []).map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className={m.completed || m.completed_at ? 'text-[color:var(--text-3)] line-through' : ''}>{m.name}</span>
                  <span className="text-xs text-[color:var(--text-3)]">{fmt(m.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
