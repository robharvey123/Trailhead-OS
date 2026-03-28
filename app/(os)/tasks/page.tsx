import MasterTaskListClient from '@/components/os/MasterTaskListClient'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function TasksPage() {
  const supabase = await createClient()
  const [tasks, workstreams] = await Promise.all([
    getTasks({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return <MasterTaskListClient initialTasks={tasks} workstreams={workstreams} />
}
