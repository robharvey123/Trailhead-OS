import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSalesScopePrefixes, listSalesContacts, listSalesProducts, summarise } from '@/lib/sales/data'

export const metadata = { title: 'Sales dashboard | Trailhead OS' }

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[color:var(--text-3)]">{hint}</p> : null}
    </div>
  )
}

export default async function SalesDashboardPage() {
  const supabase = await createClient()
  const [prefixes, contacts, products] = await Promise.all([
    getSalesScopePrefixes(supabase),
    listSalesContacts(supabase),
    listSalesProducts(supabase),
  ])
  const s = summarise(contacts, prefixes)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Your list: contacts tagged {prefixes.map((p) => `"${p}…"`).join(' or ')}.
        </p>
      </div>

      <section aria-label="List health" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="On your list" value={s.inScope} />
        <Tile label="Callable now" value={s.callable} hint="CTPS-clear in the last 28 days" />
        <Tile label="Needs a CTPS screen" value={s.needsScreening} hint="Hidden from calling until screened" />
        <Tile label="Unsubscribed or bounced" value={s.unsubscribedOrBounced} hint="Never called" />
      </section>

      <section className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lists</h2>
          <Link href="/sales/contacts" className="text-sm text-[color:var(--accent-strong)] hover:underline">All contacts</Link>
        </div>
        {s.byTag.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">No contacts carry a sales tag yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {s.byTag.map((t) => (
              <li key={t.tag} className="flex items-center justify-between py-2 text-sm">
                <span>{t.tag}</span>
                <span className="tabular-nums text-[color:var(--text-2)]">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">Product context</h2>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Read-only. Where each product is, so calls can speak to it.</p>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing shared yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/sales/products/${p.id}`} className="card block hover:border-[var(--accent)]">
                  <span className="block text-sm font-medium">{p.name}</span>
                  {p.status ? <span className="mt-1 block text-xs capitalize text-[color:var(--text-3)]">{p.status}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
