'use client'

import { useState } from 'react'
import Link from 'next/link'
import StartConversationModal from './StartConversationModal'
import NewChannelModal from './NewChannelModal'

export type ConversationRow = {
  id: string
  kind: 'dm' | 'channel'
  title: string
  memberCount: number
  lastBody: string | null
  lastAt: string | null
  unread: number
}

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function Row({ c, activeId }: { c: ConversationRow; activeId?: string }) {
  const icon = c.kind === 'channel' ? '#' : c.title.slice(0, 2).toUpperCase()
  return (
    <Link
      href={`/messages/${c.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none', background: c.id === activeId ? 'var(--surface-2)' : 'transparent' }}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--surface-3)] text-xs text-[var(--text-2)]">{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span className="td-name" style={{ fontWeight: c.unread ? 700 : 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.title}
            {c.kind === 'channel' ? <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 12 }}> · {c.memberCount}</span> : null}
          </span>
          <span className="td-mono" style={{ fontSize: 11, color: 'var(--text-3)', flex: 'none' }}>{fmtWhen(c.lastAt)}</span>
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: c.unread ? 'var(--text)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastBody || 'No messages yet'}</span>
          {c.unread > 0 ? (
            <span style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>
          ) : null}
        </span>
      </span>
    </Link>
  )
}

function GroupHeader({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px', position: 'sticky', top: 0, background: 'var(--surface)' }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>{label}</span>
      <button className="text-xs font-medium text-[var(--accent)] hover:opacity-80" onClick={onAction}>{action}</button>
    </div>
  )
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
  const [channelModal, setChannelModal] = useState(false)
  const [dmModal, setDmModal] = useState(false)

  const channels = conversations.filter((c) => c.kind === 'channel')
  const dms = conversations.filter((c) => c.kind === 'dm')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="panel-section-title" style={{ margin: 0 }}>Messages</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <GroupHeader label="Channels" action="+ New channel" onAction={() => setChannelModal(true)} />
        {channels.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 16px 12px' }}>No channels yet.</p>
        ) : channels.map((c) => <Row key={c.id} c={c} activeId={activeId} />)}

        <GroupHeader label="Direct messages" action="+ Start DM" onAction={() => setDmModal(true)} />
        {dms.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 16px 12px' }}>No direct messages yet.</p>
        ) : dms.map((c) => <Row key={c.id} c={c} activeId={activeId} />)}
      </div>

      {channelModal ? <NewChannelModal users={users} onClose={() => setChannelModal(false)} /> : null}
      {dmModal ? <StartConversationModal users={users} onClose={() => setDmModal(false)} /> : null}
    </div>
  )
}
