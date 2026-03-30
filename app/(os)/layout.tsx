import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import OsShell from '@/components/os/OsShell'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { Workstream } from '@/lib/types'

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

  let workstreams: Workstream[] = []
  let newEnquiryCount = 0

  try {
    workstreams = await getWorkstreams(supabase)
  } catch {
    workstreams = []
  }

  try {
    const { count } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')

    newEnquiryCount = count ?? 0
  } catch {
    newEnquiryCount = 0
  }

  return (
    <OsShell workstreams={workstreams} newEnquiryCount={newEnquiryCount}>
      {children}
    </OsShell>
  )
}
