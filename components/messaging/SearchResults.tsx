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
        re.test(p) ? <mark key={i} style={{ background: 'var(--accent-dim)', color: 'var(--accent-strong)', padding: '0 1px', borderRadius: 2 }}>{p}</mark> : <Fragment key={i}>{p}</Fragment>
      )}
    </>
  )
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SearchResults({ groups, query, loading }: { groups: SearchGroup[]; query: string; loading: boolean }) {
  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-3)', padding: 16 }}>Searching…</p>
  if (groups.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-3)', padding: 16 }}>No messages match “{query}”.</p>

  return (
    <div>
      {groups.map((g) => (
        <div key={g.conversationId}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--surface)', padding: '8px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>
            {g.kind === 'channel' ? `# ${g.title}` : g.title}
          </div>
          {g.messages.map((m) => (
            <Link
              key={m.id}
              href={`/messages/${g.conversationId}?msg=${m.id}`}
              style={{ display: 'block', padding: '10px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
            >
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="td-name" style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.senderName}</span>
                <span className="td-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtWhen(m.createdAt)}</span>
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                <Highlighted text={m.body} query={query} />
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}
