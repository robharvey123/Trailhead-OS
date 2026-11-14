'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import type { SearchGroup } from '@/app/(os)/messages/actions'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Client-side highlight: wrap query terms (ignoring operators/short words). */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query
    .replace(/["()-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !['or', 'and'].includes(t.toLowerCase()))
  if (terms.length === 0) return <>{text}</>
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? <mark key={i} className="rounded-control bg-[var(--accent-dim)] px-px text-[var(--accent-strong)]">{p}</mark> : <Fragment key={i}>{p}</Fragment>
      )}
    </>
  )
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SearchResults({ groups, query, loading }: { groups: SearchGroup[]; query: string; loading: boolean }) {
  if (loading) return <p className="p-4 text-[13px] text-[var(--text-3)]">Searching…</p>
  if (groups.length === 0) return <p className="p-4 text-[13px] text-[var(--text-3)]">No messages match “{query}”.</p>

  return (
    <div>
      {groups.map((g) => (
        <div key={g.conversationId}>
          <div className="os-label sticky top-0 bg-[var(--surface)] px-4 py-2">
            {g.kind === 'channel' ? `# ${g.title}` : g.title}
          </div>
          {g.messages.map((m) => (
            <Link
              key={m.id}
              href={`/messages/${g.conversationId}?msg=${m.id}`}
              className="block border-b border-[var(--border)] px-4 py-2.5 no-underline"
            >
              <span className="flex justify-between gap-2">
                <span className="td-name text-xs text-[var(--text-2)]">{m.senderName}</span>
                <span className="td-num">{fmtWhen(m.createdAt)}</span>
              </span>
              <span className="mt-0.5 block text-[13px] text-[var(--text)]">
                <Highlighted text={m.body} query={query} />
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
