import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSalesScopePrefixes } from '@/lib/sales/data'
import { listPipelineContacts } from '@/lib/sales/queue'
import PipelineClient from './PipelineClient'

export const metadata = { title: 'Pipeline | Sales | Trailhead OS' }

export default async function SalesPipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/sales/pipeline')
  const [contacts, prefixes] = await Promise.all([listPipelineContacts(supabase), getSalesScopePrefixes(supabase)])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">Every contact on your lists, by stage.</p>
      </div>
      <PipelineClient initialContacts={contacts} prefixes={prefixes} currentUserId={user.id} />
    </div>
  )
}
