import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listSalesContacts } from '@/lib/sales/data'
import EligibilityBadge from '@/components/sales/EligibilityBadge'

export const metadata = { title: 'Contacts | Sales | Trailhead OS' }

export default async function SalesContactsPage() {
  const supabase = await createClient()
  const contacts = await listSalesContacts(supabase)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">{contacts.length} on your list.</p>
      </div>
      {contacts.length === 0 ? (
        <div className="panel empty">No contacts on your list yet.</div>
      ) : (
        <>
        {/* Phones: one card per contact, so the number is always visible. */}
        <ul className="space-y-2 sm:hidden">
          {contacts.map((c) => (
            <li key={c.id} className="panel p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/sales/contacts/${c.id}`} className="font-medium hover:underline">{c.company ?? c.name}</Link>
                <EligibilityBadge eligibility={c.eligibility} />
              </div>
              <p className="mt-0.5 text-xs text-[color:var(--text-3)]">{[c.name, c.role, c.sub_trade, c.city].filter(Boolean).join(' · ')}</p>
              {c.phone ? (
                c.eligibility?.eligible
                  ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="mt-2 inline-block text-sm font-medium text-[color:var(--accent-strong)]">Call {c.phone}</a>
                  : <p className="mt-2 text-sm text-[color:var(--text-3)]">{c.phone}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="panel hidden overflow-x-auto sm:block">
          <table className="data-table">
            <thead>
              <tr><th>Company</th><th>Contact</th><th>Sub-trade</th><th>City</th><th>Phone</th><th>Calling</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/sales/contacts/${c.id}`} className="font-medium hover:underline">{c.company ?? c.name}</Link></td>
                  <td>{c.name}{c.role ? <span className="block text-xs text-[color:var(--text-3)]">{c.role}</span> : null}</td>
                  <td>{c.sub_trade ?? ''}</td>
                  <td>{c.city ?? ''}</td>
                  <td className="whitespace-nowrap">
                    {/* Only offer the dial link when the shared rule says the number is callable. */}
                    {c.phone && c.eligibility?.eligible ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="hover:underline">{c.phone}</a> : <span className="text-[color:var(--text-3)]">{c.phone ?? ''}</span>}
                  </td>
                  <td><EligibilityBadge eligibility={c.eligibility} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
