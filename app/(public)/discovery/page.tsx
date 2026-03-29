import { headers } from 'next/headers'
import Sidebar from '@/components/os/Sidebar'
import DiscoveryOSClient, {
  type DiscoveryEnquiryRow,
} from '@/components/os/DiscoveryOSClient'
import PublicDiscoveryForm from '@/components/discovery/PublicDiscoveryForm'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { Workstream } from '@/lib/types'

export default async function DiscoveryPage() {
  const requestHeaders = await headers()
  const isIframeRequest = requestHeaders.get('sec-fetch-dest') === 'iframe'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || isIframeRequest) {
    return <PublicDiscoveryForm />
  }

  let workstreams: Workstream[] = []
  let newEnquiryCount = 0
  let enquiries: DiscoveryEnquiryRow[] = []

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

  try {
    const { data } = await supabase
      .from('enquiries')
      .select('id, biz_name, contact_name, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10)

    enquiries = (data ?? []) as DiscoveryEnquiryRow[]
  } catch {
    enquiries = []
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar workstreams={workstreams} newEnquiryCount={newEnquiryCount} />
      <main className="min-h-screen md:pl-72">
        <div className="mx-auto min-h-screen max-w-screen-2xl px-4 pb-8 pt-20 md:px-8 md:pt-8">
          <DiscoveryOSClient enquiries={enquiries} />
        </div>
      </main>
    </div>
  )
}
