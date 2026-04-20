import ContactImportClient from '@/components/os/ContactImportClient'
import { createClient } from '@/lib/supabase/server'

export default async function ContactImportPage() {
  const supabase = await createClient()

  const [{ data: workstreams }, { data: projects }] = await Promise.all([
    supabase
      .from('workstreams')
      .select('id, slug, label')
      .order('sort_order'),
    supabase
      .from('projects')
      .select('id, name, workstream_id')
      .in('status', ['planning', 'active'])
      .order('name'),
  ])

  return (
    <ContactImportClient
      workstreams={workstreams ?? []}
      projects={projects ?? []}
    />
  )
}
