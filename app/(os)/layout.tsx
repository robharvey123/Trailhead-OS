import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/os/Sidebar'
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar workstreams={workstreams} newEnquiryCount={newEnquiryCount} />
      <main className="min-h-screen md:pl-72">
        <div className="mx-auto min-h-screen max-w-screen-2xl px-4 pb-8 pt-20 md:px-8 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
