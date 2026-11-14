import AccountForm from '@/components/os/AccountForm'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'New account' }

export default async function NewAccountPage() {
  const supabase = await createClient()
  const workstreams = await getWorkstreams(supabase).catch(() => [])

  return (
    <div className="os-narrow">
      <AccountForm workstreams={workstreams} />
    </div>
  )
}
