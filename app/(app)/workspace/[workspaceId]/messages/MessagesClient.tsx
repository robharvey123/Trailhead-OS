'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CommChannel, CommMessage, ChannelType } from '@/lib/comms/types'
import { CHANNEL_TYPES, CHANNEL_TYPE_LABELS } from '@/lib/comms/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

export default function MessagesClient({ workspaceId, initialChannels }: { workspaceId: string; initialChannels: CommChannel[] }) {
  const [channels, setChannels] = useState(initialChannels)
  const [activeChannel, setActiveChannel] = useState<CommChannel | null>(initialChannels[0] || null)
  const [messages, setMessages] = useState<CommMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<ChannelType>('general')
  const [channelDesc, setChannelDesc] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (channel: CommChannel) => {
    const { messages: msgs } = await apiFetch<{ messages: CommMessage[] }>(`/api/comms/channels/${channel.id}?workspace_id=${workspaceId}`)
    setMessages(msgs)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [workspaceId])

  useEffect(() => {
    if (activeChannel) loadMessages(activeChannel)
  }, [activeChannel, loadMessages])

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChannel) return
    const { message } = await apiFetch<{ message: CommMessage }>(`/api/comms/channels/${activeChannel.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, body: newMessage.trim() }) })
    setMessages((prev) => [...prev, message])
    setNewMessage('')
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [workspaceId, activeChannel, newMessage])

  const handleCreateChannel = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const { channel } = await apiFetch<{ channel: CommChannel }>('/api/comms/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, name: channelName, type: channelType, description: channelDesc || null }) })
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)))
    setActiveChannel(channel)
    setShowNewChannel(false); setChannelName(''); setChannelType('general'); setChannelDesc('')
  }, [workspaceId, channelName, channelType, channelDesc])

  const handleDeleteChannel = useCallback(async (id: string) => {
    await apiFetch(`/api/comms/channels/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setChannels((prev) => prev.filter((c) => c.id !== id))
    if (activeChannel?.id === id) { setActiveChannel(null); setMessages([]) }
  }, [workspaceId, activeChannel])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Comms</p>
        <h1 className="mt-1 text-2xl font-semibold">Messages</h1>
      </div>

      <div className="flex rounded-2xl border border-slate-800 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Channel sidebar */}
        <div className="w-56 shrink-0 border-r border-slate-800 bg-slate-950/60 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-400">Channels</span>
            <button onClick={() => setShowNewChannel(true)} className="text-xs text-blue-400 hover:text-blue-300">+</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {channels.map((ch) => (
              <button key={ch.id} onClick={() => setActiveChannel(ch)} className={`w-full px-3 py-2 text-left text-sm transition ${activeChannel?.id === ch.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                <span className="font-medium"># {ch.name}</span>
                <span className="ml-1 text-[10px] text-slate-500">{CHANNEL_TYPE_LABELS[ch.type]}</span>
              </button>
            ))}
            {channels.length === 0 && <p className="px-3 py-4 text-xs text-slate-500">No channels</p>}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex flex-1 flex-col">
          {activeChannel ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                <div>
                  <span className="font-medium"># {activeChannel.name}</span>
                  {activeChannel.description && <span className="ml-2 text-xs text-slate-400">{activeChannel.description}</span>}
                </div>
                <button onClick={() => handleDeleteChannel(activeChannel.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && <p className="text-center text-sm text-slate-500 py-8">No messages yet. Start the conversation!</p>}
                {messages.map((m) => (
                  <div key={m.id} className="group">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-slate-300">{m.sender_id.slice(0, 8)}</span>
                      <span className="text-[10px] text-slate-600">{new Date(m.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-200">{m.body}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="border-t border-slate-800 px-4 py-3 flex gap-2">
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={`Message #${activeChannel.name}…`} className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500" />
                <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">Send</button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-500">Select a channel to start messaging</div>
          )}
        </div>
      </div>

      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewChannel(false)}>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">New Channel</h2>
            <form onSubmit={handleCreateChannel} className="mt-4 space-y-4">
              <div><label className="mb-1 block text-xs text-slate-400">Name *</label><input required value={channelName} onChange={(e) => setChannelName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Type</label><select value={channelType} onChange={(e) => setChannelType(e.target.value as ChannelType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{CHANNEL_TYPES.map((t) => <option key={t} value={t}>{CHANNEL_TYPE_LABELS[t]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Description</label><input value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">Create</button>
                <button type="button" onClick={() => setShowNewChannel(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
