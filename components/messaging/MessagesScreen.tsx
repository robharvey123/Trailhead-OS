'use client'

import { useEffect, useState } from 'react'
import { searchMessages, type SearchGroup } from '@/app/(os)/messages/actions'
import ConversationList, { type ConversationRow } from './ConversationList'
import SearchBar from './SearchBar'
import SearchResults from './SearchResults'

export default function MessagesScreen({
  conversations,
  users,
}: {
  conversations: ConversationRow[]
  users: Array<{ id: string; name: string }>
}) {
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [searching, setSearching] = useState(false)

  // Debounce the input → query (250ms).
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw.trim()), 250)
    return () => clearTimeout(t)
  }, [raw])

  useEffect(() => {
    if (!query) return // stale groups stay hidden — ConversationList renders when query is empty
    let active = true
    void (async () => {
      setSearching(true)
      const r = await searchMessages(query)
      if (active) { setGroups(r.groups); setSearching(false) }
    })()
    return () => { active = false }
  }, [query])

  return (
    <div className="flex h-full flex-col">
      <SearchBar value={raw} onChange={setRaw} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {query ? (
          <SearchResults groups={groups} query={query} loading={searching} />
        ) : (
          <ConversationList conversations={conversations} users={users} />
        )}
      </div>
    </div>
  )
}
