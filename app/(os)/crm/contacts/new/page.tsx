import NewContactForm from '@/components/os/NewContactForm'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewContactPage() {
  const supabase = await createClient()
  const workstreams = await getWorkstreams(supabase).catch(() => [])

  return <NewContactForm workstreams={workstreams} />
}
