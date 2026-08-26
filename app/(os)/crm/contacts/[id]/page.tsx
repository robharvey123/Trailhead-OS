import { notFound } from 'next/navigation'
import ContactDetailClient from '@/components/os/ContactDetailClient'
import { getAccounts } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { listMeetingNotesForContact } from '@/lib/db/meeting-notes'
import { listMeetingsForContact } from '@/lib/db/meetings'
import { listConversationsForContact, withMessages } from '@/lib/db/whatsapp'
import { listThreads } from '@/lib/db/inbox'
import { getCompanySettings } from '@/lib/company-settings'
import { listProjectsByContact, listProjectsByAccount } from '@/lib/db/projects'
import { listEngagements } from '@/lib/db/engagements'
import { getQuotes } from '@/lib/db/quotes'
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

  const [contact, workstreams, accounts, linkedTasks, enquiryResult, touchpointsResult, projects, quotes, meetingNotes, meetings, whatsappConversations, emailThreads, companySettings, userResult] = await Promise.all([
    getContactById(id, supabase).catch(() => null),
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getTasks({ contact_id: id }, supabase).catch(() => []),
    enquiryPromise,
    touchpointsPromise,
    listProjectsByContact(id, supabase).catch(() => []),
    getQuotes({ contact_id: id }, supabase).catch(() => []),
    listMeetingNotesForContact(id, supabase).catch(() => []),
    listMeetingsForContact(id, supabase).catch(() => []),
    listConversationsForContact(id, supabase).then((c) => withMessages(c, { includeDrafts: true, limit: 500 }, supabase)).catch(() => []),
    listThreads({ contactId: id }, supabase).catch(() => []),
    getCompanySettings(supabase).catch(() => null),
    supabase.auth.getUser(),
  ])

  if (!contact) {
    notFound()
  }

  // A contact belongs to an account, so the account's engagements and projects
  // surface here automatically — alongside any project linked directly to the
  // contact. Fetched after the contact so we know its account.
  const accountId = contact.account_id
  const [accountEngagements, accountProjects] = await Promise.all([
    accountId ? listEngagements({ accountId }, supabase).catch(() => []) : [],
    accountId ? listProjectsByAccount(accountId, supabase).catch(() => []) : [],
  ])
  // Merge explicit (contact-linked) + account projects, dedup by id, explicit first.
  const projectsById = new Map<string, (typeof projects)[number]>()
  for (const p of [...projects, ...accountProjects]) if (!projectsById.has(p.id)) projectsById.set(p.id, p)
  const allProjects = [...projectsById.values()]
  const linkedProjectIds = new Set(projects.map((p) => p.id))

  const workstream =
    workstreams.find((item: Workstream) => item.id === contact.workstream_id) ?? null
  const account = accounts.find((item) => item.id === contact.account_id) ?? null

  return (
    <ContactDetailClient
      initialContact={{ ...contact, workstream, account }}
      workstreams={workstreams}
      accounts={accounts}
      linkedTasks={linkedTasks}
      linkedQuotes={quotes}
      sourceEnquiryId={enquiryResult.data?.id ?? null}
      initialTouchpoints={touchpointsResult.data ?? []}
      meetingNotes={meetingNotes}
      meetings={meetings}
      whatsappConversations={whatsappConversations}
      emailThreads={emailThreads}
      selfEmail={userResult.data.user?.email ?? ''}
      signature={companySettings?.email_signature ?? ''}
      projects={allProjects}
      linkedProjectIds={[...linkedProjectIds]}
      engagements={accountEngagements.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        code: e.code ?? null,
        end_client_name: e.end_client?.name ?? null,
      }))}
    />
  )
}
