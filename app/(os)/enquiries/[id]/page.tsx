import { notFound } from 'next/navigation'
import EnquiryDetailActions from '@/components/os/EnquiryDetailActions'
import { getEnquiryById } from '@/lib/db/enquiries'
import { createClient } from '@/lib/supabase/server'

const QUESTION_LABELS: Array<{ key: string; label: string }> = [
  { key: 'biz_name', label: 'Business name' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'biz_type', label: 'Business type' },
  { key: 'team_size', label: 'Team size' },
  { key: 'team_split', label: 'Team split' },
  { key: 'top_features', label: 'Top features' },
  { key: 'calendar_detail', label: 'Calendar detail' },
  { key: 'forms_detail', label: 'Forms detail' },
  { key: 'devices', label: 'Devices' },
  { key: 'offline_capability', label: 'Offline capability' },
  { key: 'existing_tools', label: 'Existing tools' },
  { key: 'pain_points', label: 'Pain points' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'budget', label: 'Budget' },
  { key: 'extra', label: 'Extra context' },
]

function formatAnswer(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  if (value === null || value === undefined) {
    return '—'
  }

  return String(value)
}

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const enquiry = await getEnquiryById(id, supabase).catch(() => null)

  if (!enquiry) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Enquiries</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">{enquiry.biz_name}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Discovery submission from {enquiry.contact_name}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Submission details</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {QUESTION_LABELS.map((item) => (
              <div key={item.key} className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
                  {formatAnswer(enquiry[item.key as keyof typeof enquiry])}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <EnquiryDetailActions enquiry={enquiry} />
        </div>
      </div>
    </div>
  )
}
