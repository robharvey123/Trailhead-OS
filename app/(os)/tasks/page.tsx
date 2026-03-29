import MasterTaskListClient from '@/components/os/MasterTaskListClient'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function TasksPage() {
  const supabase = await createClient()
  const [tasks, workstreams, accounts, contacts] = await Promise.all([
    getTasks({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
  ])

  return (
    <MasterTaskListClient
      initialTasks={tasks}
      workstreams={workstreams}
      accounts={accounts}
      contacts={contacts}
    />
  )
}
