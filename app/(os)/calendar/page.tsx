import CalendarClient from '@/components/os/CalendarClient'
import { getContacts } from '@/lib/db/contacts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function CalendarPage() {
  const supabase = await createClient()
  const [workstreams, contacts] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
  ])

  return <CalendarClient workstreams={workstreams} contacts={contacts} />
}
