import { notFound } from 'next/navigation'
import ContactDetailClient from '@/components/os/ContactDetailClient'
import { getAccounts } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { listProjectsByContact } from '@/lib/db/projects'
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
  const touchpointsPromise = supabase
    .from('touchpoints')
    .select('*')
    .eq('contact_id', id)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  const [contact, workstreams, accounts, linkedTasks, enquiryResult, touchpointsResult, projects] = await Promise.all([
    getContactById(id, supabase).catch(() => null),
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getTasks({ contact_id: id }, supabase).catch(() => []),
    enquiryPromise,
    touchpointsPromise,
    listProjectsByContact(id, supabase).catch(() => []),
  ])

  if (!contact) {
    notFound()
  }

  const workstream =
    workstreams.find((item: Workstream) => item.id === contact.workstream_id) ?? null
  const account = accounts.find((item) => item.id === contact.account_id) ?? null

  return (
    <ContactDetailClient
      initialContact={{ ...contact, workstream, account }}
      workstreams={workstreams}
      accounts={accounts}
      linkedTasks={linkedTasks}
      sourceEnquiryId={enquiryResult.data?.id ?? null}
      initialTouchpoints={touchpointsResult.data ?? []}
      projects={projects}
    />
  )
}
