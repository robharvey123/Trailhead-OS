import CalendarClient from '@/components/os/CalendarClient'
import { getContacts } from '@/lib/db/contacts'
import { getProjects } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function CalendarPage() {
  const supabase = await createClient()
  const [workstreams, contacts, projects, googleTokenResult] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    (async () => {
      try {
        return await supabase.from('google_tokens').select('id').limit(1).maybeSingle()
      } catch {
        return { data: null }
      }
    })(),
  ])

  return (
    <CalendarClient
      workstreams={workstreams}
      contacts={contacts}
      projects={projects}
      googleConnected={Boolean(googleTokenResult.data)}
    />
  )
}
