'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import AccountForm from './AccountForm'
import QuickAddTask from './QuickAddTask'
import StatusBadge from './StatusBadge'
import WorkstreamBadge from './WorkstreamBadge'
import { calculateTotals } from '@/lib/types'
import type { Workstream } from '@/lib/types'
import type { AccountDetail } from '@/lib/db/accounts'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function AccountDetailClient({
  initialAccount,
  workstreams,
}: {
  initialAccount: AccountDetail
  workstreams: Workstream[]
}) {
  const router = useRouter()
  const [account, setAccount] = useState(initialAccount)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialAccount.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const openTasks = useMemo(
    () => account.recent_tasks.filter((task) => !task.completed_at),
    [account.recent_tasks]
  )
  const completedTasks = useMemo(
    () => account.recent_tasks.filter((task) => Boolean(task.completed_at)),
    [account.recent_tasks]
  )

  async function saveNotesOnBlur() {
    if ((account.notes ?? '') === notes) {
      return
    }

    setNotesSaving(true)
    setNotesError(null)

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save notes')
      }

      setAccount((current) => ({
        ...current,
        ...data.account,
        recent_quotes: current.recent_quotes,
        recent_tasks: current.recent_tasks,
        invoices: current.invoices,
        source_enquiry: current.source_enquiry,
        contacts: current.contacts,
        quotes: current.quotes,
      }))
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">{account.name}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Account overview across contacts, delivery, and commercial work.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          {editing ? (
            <AccountForm
              workstreams={workstreams}
              initialAccount={account}
              onSaved={(updatedAccount) => {
                setAccount((current) => ({
                  ...current,
                  ...updatedAccount,
                  recent_quotes: current.recent_quotes,
                  recent_tasks: current.recent_tasks,
                  invoices: current.invoices,
                  source_enquiry: current.source_enquiry,
                  contacts: current.contacts,
                  quotes: current.quotes,
                }))
                setNotes(updatedAccount.notes ?? '')
                setEditing(false)
                router.refresh()
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={account.status} kind="account" />
                {account.workstream ? (
                  <WorkstreamBadge
                    label={account.workstream.label}
                    slug={account.workstream.label}
                    colour={account.workstream.colour}
                  />
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Website</p>
                  {account.website ? (
                    <a
                      href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm text-sky-300 hover:text-sky-200"
                    >
                      {account.website}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-slate-200">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Industry</p>
                  <p className="mt-2 text-sm text-slate-200">{account.industry ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Size</p>
                  <p className="mt-2 text-sm text-slate-200">{account.size ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Address</p>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                    {[
                      account.address_line1,
                      account.address_line2,
                      account.city,
                      account.postcode,
                      account.country,
                    ]
                      .filter(Boolean)
                      .join('\n') || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Contacts</h2>
                <p className="text-sm text-slate-400">People linked to this account.</p>
              </div>
              <Link
                href={`/crm/contacts/new?account_id=${account.id}`}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              >
                Add contact
              </Link>
            </div>

            {account.contacts?.length ? (
              <div className="mt-4 space-y-3">
                {account.contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/crm/contacts/${contact.id}`}
                    className="block rounded-3xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-600"
                  >
                    <p className="font-medium text-slate-100">{contact.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{contact.role ?? 'No role set'}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {contact.email ?? 'No email'} {contact.phone ? `· ${contact.phone}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
                No contacts linked yet.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Tasks</h2>
                <p className="text-sm text-slate-400">Open follow-ups and completed work.</p>
              </div>
              <Link href="/tasks" className="text-sm text-slate-400 transition hover:text-slate-200">
                Open master tasks
              </Link>
            </div>

            <div className="mt-4">
              <QuickAddTask
                workstream_id={account.workstream_id ?? null}
                account_id={account.id}
                placeholder="Add a task for this account..."
                onCreated={() => router.refresh()}
              />
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Open</p>
                {openTasks.length ? (
                  <div className="mt-3 space-y-3">
                    {openTasks.map((task) => (
                      <div key={task.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="font-medium text-slate-100">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Due: {task.due_date ?? 'No due date'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No open tasks.</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Completed</p>
                {completedTasks.length ? (
                  <div className="mt-3 space-y-3">
                    {completedTasks.map((task) => (
                      <div key={task.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="font-medium text-slate-100">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Completed {task.completed_at?.slice(0, 10) ?? 'Recently'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No completed tasks yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
                <p className="text-sm text-slate-400">Auto-saves when you leave the field.</p>
              </div>
              {notesSaving ? <p className="text-xs text-slate-500">Saving…</p> : null}
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNotesOnBlur}
              rows={8}
              className="mt-4 w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
            {notesError ? <p className="mt-3 text-sm text-rose-300">{notesError}</p> : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Quotes</h2>
                <p className="text-sm text-slate-400">Proposals and pricing for this account.</p>
              </div>
              <Link
                href={`/quotes/new?account_id=${account.id}`}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                New quote
              </Link>
            </div>

            {account.recent_quotes.length ? (
              <div className="mt-4 space-y-3">
                {account.recent_quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/quotes/${quote.id}`}
                    className="block rounded-3xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{quote.quote_number}</p>
                        <p className="mt-1 text-sm text-slate-300">{quote.title}</p>
                        <p className="mt-2 text-xs text-slate-500">{quote.issue_date}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={quote.status} kind="quote" />
                        <p className="mt-2 text-sm font-medium text-slate-100">
                          {formatMoney(calculateTotals(quote.line_items, quote.vat_rate).total)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
                No quotes yet.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Invoices</h2>
                <p className="text-sm text-slate-400">Billing history for this account.</p>
              </div>
              <Link
                href={`/invoicing/new?account_id=${account.id}`}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              >
                New invoice
              </Link>
            </div>

            {account.invoices.length ? (
              <div className="mt-4 space-y-3">
                {account.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoicing/${invoice.id}`}
                    className="block rounded-3xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{invoice.invoice_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{invoice.issue_date}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={invoice.status} kind="invoice" />
                        <p className="mt-2 text-sm font-medium text-slate-100">
                          {formatMoney(calculateTotals(invoice.line_items, invoice.vat_rate).total)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
                No invoices yet.
              </div>
            )}
          </div>

          {account.source_enquiry ? (
            <div className="rounded-[2rem] border border-sky-500/30 bg-sky-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Source enquiry</p>
              <p className="mt-3 text-sm text-sky-50">{account.source_enquiry.biz_name}</p>
              <Link
                href={`/enquiries/${account.source_enquiry.id}`}
                className="mt-3 inline-flex text-sm font-medium text-white hover:underline"
              >
                View enquiry
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
