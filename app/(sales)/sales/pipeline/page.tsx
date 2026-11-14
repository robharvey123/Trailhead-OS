import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSalesScopePrefixes } from '@/lib/sales/data'
import { listPipelineContacts } from '@/lib/sales/queue'
import PageHeader from '@/components/ui/PageHeader'
import PipelineClient from './PipelineClient'

export const metadata = { title: 'Pipeline | Sales' }

export default async function SalesPipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/sales/pipeline')
  const [contacts, prefixes] = await Promise.all([listPipelineContacts(supabase), getSalesScopePrefixes(supabase)])
  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" description="Every contact on your lists, by stage." />
      <PipelineClient initialContacts={contacts} prefixes={prefixes} currentUserId={user.id} />
    </div>
  )
}
