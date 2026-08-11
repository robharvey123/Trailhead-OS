import CalendarClient from '@/components/os/CalendarClient'
import { getContacts } from '@/lib/db/contacts'
import { getProjects } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { listEngagements } from '@/lib/db/engagements'
import { createClient } from '@/lib/supabase/server'

export default async function CalendarPage() {
  const supabase = await createClient()
  const [workstreams, contacts, projects, accountsResult, engagementRows, googleTokenResult, feedsResult] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    supabase.from('accounts').select('id, name').order('name'),
    listEngagements({ excludeTerminal: true }, supabase).catch(() => []),
    (async () => {
      try {
        return await supabase.from('google_tokens').select('id').limit(1).maybeSingle()
      } catch {
        return { data: null }
      }
    })(),
    (async () => {
      try {
        return await supabase.from('calendar_feeds').select('id, name, colour').order('name')
      } catch {
        return { data: [] }
      }
    })(),
  ])

  return (
    <CalendarClient
      workstreams={workstreams}
      contacts={contacts}
      projects={projects}
      accounts={(accountsResult.data ?? []) as Array<{ id: string; name: string }>}
      engagements={engagementRows.map((e) => ({ id: e.id, name: e.name }))}
      googleConnected={Boolean(googleTokenResult.data)}
      feeds={(feedsResult.data ?? []) as Array<{ id: string; name: string; colour: string | null }>}
    />
  )
}
