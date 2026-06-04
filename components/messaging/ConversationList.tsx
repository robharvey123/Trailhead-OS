'use client'

import { useState } from 'react'
import Link from 'next/link'
import StartConversationModal from './StartConversationModal'

export type ConversationRow = {
  id: string
  otherName: string
  lastBody: string | null
  lastAt: string | null
  unread: number
}

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function ConversationList({
  conversations,
  users,
  activeId,
}: {
  conversations: ConversationRow[]
  users: Array<{ id: string; name: string }>
  activeId?: string
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="panel-section-title" style={{ margin: 0 }}>Messages</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>New</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', padding: 16 }}>No conversations yet. Start one with “New”.</p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                textDecoration: 'none',
                background: c.id === activeId ? 'var(--surface-2)' : 'transparent',
              }}
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--surface-3)] text-xs text-[var(--text-2)]">
                {c.otherName.slice(0, 2).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="td-name" style={{ fontWeight: c.unread ? 700 : 600, color: 'var(--text)' }}>{c.otherName}</span>
                  <span className="td-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtWhen(c.lastAt)}</span>
                </span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: c.unread ? 'var(--text)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lastBody || 'No messages yet'}
                  </span>
                  {c.unread > 0 ? (
                    <span style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.unread}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>

      {modalOpen ? <StartConversationModal users={users} onClose={() => setModalOpen(false)} /> : null}
    </div>
  )
}
