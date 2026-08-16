import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import OsShell from '@/components/os/OsShell'
import { getCurrentProfile } from '@/lib/auth/roles'
import { getUnreadTaskCount, getUnreadMailCount, getUnreadMessagesCount, getUnreadMentionsCount } from '@/lib/notifications/unread'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OsLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // These six badge counts are independent of each other. Awaiting them in
  // series put ~6 round-trips on the critical path of every OS navigation,
  // because this is the layout. They now run concurrently.
  //
  // `null` means "this query failed" and is rendered as a warning glyph, not a
  // zero — a broken Gmail token used to make the Inbox badge read 0, which is
  // indistinguishable from an empty inbox.
  const settled = (result: PromiseSettledResult<number>): number | null =>
    result.status === 'fulfilled' ? result.value : null

  const [
    taskResult,
    mailResult,
    messageResult,
    mentionsResult,
    enquiryResult,
    quoteResult,
  ] = await Promise.allSettled([
    (async () => {
      const profile = await getCurrentProfile(supabase)
      if (!profile?.person_id) return 0
      return getUnreadTaskCount(profile.person_id, supabase)
    })(),
    getUnreadMailCount(supabase),
    getUnreadMessagesCount(user.id, supabase),
    getUnreadMentionsCount(user.id, supabase),
    (async () => {
      const { count, error } = await supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      if (error) throw error
      return count ?? 0
    })(),
    (async () => {
      const { count, error } = await supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .in('status', ['draft', 'review'])
      if (error) throw error
      return count ?? 0
    })(),
  ])

  const unreadTaskCount = settled(taskResult)
  const unreadMailCount = settled(mailResult)
  const unreadMessageCount = settled(messageResult)
  const unreadMentionsCount = settled(mentionsResult)
  const newEnquiryCount = settled(enquiryResult)
  const activeQuoteCount = settled(quoteResult)

  return (
    <OsShell
      newEnquiryCount={newEnquiryCount}
      activeQuoteCount={activeQuoteCount}
      unreadTaskCount={unreadTaskCount}
      unreadMailCount={unreadMailCount}
      unreadMessageCount={unreadMessageCount}
      unreadMentionsCount={unreadMentionsCount}
      userId={user.id}
    >
      {children}
    </OsShell>
  )
}
