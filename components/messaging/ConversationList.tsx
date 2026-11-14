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
      className={`flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 no-underline ${c.id === activeId ? 'bg-[var(--surface-2)]' : 'bg-transparent'}`}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-[var(--surface-3)] text-xs text-[var(--text-2)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2">
          <span className={`truncate text-[var(--text)] ${c.unread ? 'font-bold' : 'font-semibold'}`}>
            {c.title}
            {c.kind === 'channel' ? <span className="text-xs font-normal text-[var(--text-3)]"> · {c.memberCount}</span> : null}
          </span>
          <span className="td-num flex-none">{fmtWhen(c.lastAt)}</span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-[13px] ${c.unread ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}`}>{c.lastBody || 'No messages yet'}</span>
          {c.unread > 0 ? (
            <span className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-pill bg-[var(--accent)] px-[5px] text-[11px] font-semibold text-[var(--on-accent)]">{c.unread}</span>
          ) : null}
        </span>
      </span>
    </Link>
  )
}

function GroupHeader({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <div className="sticky top-0 flex items-center justify-between bg-[var(--surface)] px-4 pb-1.5 pt-2.5">
      <span className="os-label">{label}</span>
      <button className="btn btn-text btn-sm" onClick={onAction}>{action}</button>
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <GroupHeader label="Channels" action="+ New channel" onAction={() => setChannelModal(true)} />
        {channels.length === 0 ? (
          <p className="px-4 pb-3 pt-1 text-xs text-[var(--text-3)]">No channels yet.</p>
        ) : channels.map((c) => <Row key={c.id} c={c} activeId={activeId} />)}

        <GroupHeader label="Direct messages" action="+ Start DM" onAction={() => setDmModal(true)} />
        {dms.length === 0 ? (
          <p className="px-4 pb-3 pt-1 text-xs text-[var(--text-3)]">No direct messages yet.</p>
        ) : dms.map((c) => <Row key={c.id} c={c} activeId={activeId} />)}
      </div>

      {channelModal ? <NewChannelModal users={users} onClose={() => setChannelModal(false)} /> : null}
      {dmModal ? <StartConversationModal users={users} onClose={() => setDmModal(false)} /> : null}
    </div>
  )
}
