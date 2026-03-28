import { notFound } from 'next/navigation'
import ContactDetailClient from '@/components/os/ContactDetailClient'
import { getContactById } from '@/lib/db/contacts'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { Workstream } from '@/lib/types'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const enquiryPromise = supabase
    .from('enquiries')
    .select('id')
    .eq('converted_contact_id', id)
    .maybeSingle()

  const [contact, workstreams, linkedTasks, enquiryResult] = await Promise.all([
    getContactById(id, supabase).catch(() => null),
    getWorkstreams(supabase).catch(() => []),
    getTasks({ contact_id: id }, supabase).catch(() => []),
    enquiryPromise,
  ])

  if (!contact) {
    notFound()
  }

  const workstream =
    workstreams.find((item: Workstream) => item.id === contact.workstream_id) ?? null

  return (
    <ContactDetailClient
      initialContact={{ ...contact, workstream }}
      workstreams={workstreams}
      linkedTasks={linkedTasks}
      sourceEnquiryId={enquiryResult.data?.id ?? null}
    />
  )
}
