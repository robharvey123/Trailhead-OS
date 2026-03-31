'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import EmailThread from './EmailThread'
import EnquiryDetailActions from './EnquiryDetailActions'
import RecordEmailDialog from './RecordEmailDialog'
import SearchSelect from './SearchSelect'
import StatusBadge from './StatusBadge'
import type { Account, Enquiry, EnquiryStatus, ProjectDetail, ProjectListItem } from '@/lib/types'

type EnquiryFieldKey =
  | 'biz_name'
  | 'contact_name'
  | 'contact_email'
  | 'contact_phone'
  | 'biz_type'
  | 'project_type'
  | 'team_size'
  | 'team_split'
  | 'top_features'
  | 'calendar_detail'
  | 'forms_detail'
  | 'devices'
  | 'offline_capability'
  | 'existing_tools'
  | 'pain_points'
  | 'timeline'
  | 'referral_source'
  | 'budget'
  | 'extra'

type FieldKind = 'text' | 'email' | 'tel' | 'textarea' | 'list'

type EnquiryFormState = Record<EnquiryFieldKey, string> & {
  status: EnquiryStatus
  account_id: string
  project_id: string
}

const ENQUIRY_STATUSES: EnquiryStatus[] = ['new', 'reviewed', 'converted']

const FIELD_CONFIG: Array<{
  key: EnquiryFieldKey
  label: string
  kind: FieldKind
  rows?: number
}> = [
  { key: 'biz_name', label: 'Business name', kind: 'text' },
  { key: 'contact_name', label: 'Contact name', kind: 'text' },
  { key: 'contact_email', label: 'Contact email', kind: 'email' },
  { key: 'contact_phone', label: 'Contact phone', kind: 'tel' },
  { key: 'biz_type', label: 'Business type', kind: 'text' },
  { key: 'project_type', label: 'Project type', kind: 'text' },
  { key: 'team_size', label: 'Team size', kind: 'text' },
  { key: 'team_split', label: 'Team split', kind: 'textarea', rows: 3 },
  { key: 'top_features', label: 'Top features', kind: 'list', rows: 4 },
  { key: 'calendar_detail', label: 'Calendar detail', kind: 'textarea', rows: 4 },
  { key: 'forms_detail', label: 'Forms detail', kind: 'textarea', rows: 4 },
  { key: 'devices', label: 'Devices', kind: 'list', rows: 4 },
  { key: 'offline_capability', label: 'Offline capability', kind: 'textarea', rows: 3 },
  { key: 'existing_tools', label: 'Existing tools', kind: 'textarea', rows: 4 },
  { key: 'pain_points', label: 'Pain points', kind: 'textarea', rows: 4 },
  { key: 'timeline', label: 'Timeline', kind: 'text' },
  { key: 'referral_source', label: 'Referral source', kind: 'text' },
  { key: 'budget', label: 'Budget', kind: 'text' },
  { key: 'extra', label: 'Extra context', kind: 'textarea', rows: 5 },
]

function listToInput(value: string[]) {
  return value.join('\n')
}

function buildFormState(enquiry: Enquiry): EnquiryFormState {
  return {
    biz_name: enquiry.biz_name,
    contact_name: enquiry.contact_name,
    contact_email: enquiry.contact_email ?? '',
    contact_phone: enquiry.contact_phone ?? '',
    biz_type: enquiry.biz_type ?? '',
    project_type: enquiry.project_type ?? '',
    team_size: enquiry.team_size ?? '',
    team_split: enquiry.team_split ?? '',
    top_features: listToInput(enquiry.top_features),
    calendar_detail: enquiry.calendar_detail ?? '',
    forms_detail: enquiry.forms_detail ?? '',
    devices: listToInput(enquiry.devices),
    offline_capability: enquiry.offline_capability ?? '',
    existing_tools: enquiry.existing_tools ?? '',
    pain_points: enquiry.pain_points ?? '',
    timeline: enquiry.timeline ?? '',
    referral_source: enquiry.referral_source ?? '',
    budget: enquiry.budget ?? '',
    extra: enquiry.extra ?? '',
    status: enquiry.status,
    account_id: enquiry.account_id ?? '',
    project_id: enquiry.project_id ?? '',
  }
}

function parseListInput(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

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

function renderAnswer(key: EnquiryFieldKey, value: unknown) {
  const textValue = typeof value === 'string' ? value.trim() : ''

  if (key === 'contact_email') {
    return textValue ? (
      <a
        href={`mailto:${textValue}`}
        className="mt-3 inline-flex text-sm text-sky-300 transition hover:text-sky-200"
      >
        {textValue}
      </a>
    ) : (
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">—</p>
    )
  }

  if (key === 'contact_phone') {
    const telHref = textValue.replace(/\s+/g, '')

    return textValue ? (
      <a
        href={`tel:${telHref}`}
        className="mt-3 inline-flex text-sm text-sky-300 transition hover:text-sky-200"
      >
        {textValue}
      </a>
    ) : (
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">—</p>
    )
  }

  return (
    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
      {formatAnswer(value)}
    </p>
  )
}

function renderInput(
  field: (typeof FIELD_CONFIG)[number],
  value: string,
  onChange: (value: string) => void
) {
  if (field.kind === 'textarea' || field.kind === 'list') {
    return (
      <>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={field.rows ?? 4}
          className="mt-3 w-full rounded-[1.25rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
        {field.kind === 'list' ? (
          <p className="mt-2 text-xs text-slate-500">Use one item per line or separate with commas.</p>
        ) : null}
      </>
    )
  }

  return (
    <input
      type={field.kind}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-3 w-full rounded-[1.25rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
    />
  )
}

export default function EnquiryDetailClient({
  initialEnquiry,
  generatedQuoteId,
  accounts,
  projects,
  linkedProject,
}: {
  initialEnquiry: Enquiry
  generatedQuoteId: string | null
  accounts: Account[]
  projects: ProjectListItem[]
  linkedProject: ProjectDetail | null
}) {
  const router = useRouter()
  const [enquiry, setEnquiry] = useState(initialEnquiry)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EnquiryFormState>(() => buildFormState(initialEnquiry))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkedAccount = useMemo(
    () => accounts.find((account) => account.id === enquiry.account_id) ?? null,
    [accounts, enquiry.account_id]
  )
  const linkedProjectSummary = useMemo(
    () => projects.find((project) => project.id === enquiry.project_id) ?? null,
    [projects, enquiry.project_id]
  )
  const createProjectHref = useMemo(() => {
    const searchParams = new URLSearchParams()

    if (enquiry.account_id) {
      searchParams.set('account_id', enquiry.account_id)
    }

    searchParams.set('name', `${enquiry.biz_name} project`)

    const briefParts = [
      enquiry.project_type ? `Project type: ${enquiry.project_type}` : null,
      enquiry.pain_points ? `Pain points: ${enquiry.pain_points}` : null,
      enquiry.extra ? `Extra context: ${enquiry.extra}` : null,
    ].filter(Boolean)

    if (briefParts.length > 0) {
      searchParams.set('brief', briefParts.join('\n'))
    }

    return `/projects/new?${searchParams.toString()}`
  }, [enquiry.account_id, enquiry.biz_name, enquiry.extra, enquiry.pain_points, enquiry.project_type])

  function resetForm() {
    setForm(buildFormState(enquiry))
    setError(null)
  }

  async function saveChanges() {
    if (
      !form.biz_name.trim() ||
      !form.contact_name.trim() ||
      !form.contact_email.trim() ||
      !form.contact_phone.trim()
    ) {
      setError('Business name, contact name, contact email, and contact phone are required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { enquiry: updatedEnquiry } = await apiFetch<{ enquiry: Enquiry }>(
        `/api/enquiries/${enquiry.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            biz_name: form.biz_name,
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            contact_phone: form.contact_phone,
            biz_type: form.biz_type,
            project_type: form.project_type,
            team_size: form.team_size,
            team_split: form.team_split,
            top_features: parseListInput(form.top_features),
            calendar_detail: form.calendar_detail,
            forms_detail: form.forms_detail,
            devices: parseListInput(form.devices),
            offline_capability: form.offline_capability,
            existing_tools: form.existing_tools,
            pain_points: form.pain_points,
            timeline: form.timeline,
            referral_source: form.referral_source,
            budget: form.budget,
            extra: form.extra,
            status: form.status,
            account_id: form.account_id || null,
            project_id: form.project_id || null,
          }),
        }
      )

      setEnquiry(updatedEnquiry)
      setForm(buildFormState(updatedEnquiry))
      setEditing(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update enquiry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Enquiries</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">{enquiry.biz_name}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Discovery submission from {enquiry.contact_name}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge status={enquiry.status} kind="enquiry" />
            {linkedAccount ? (
              <Link
                href={`/crm/accounts/${linkedAccount.id}`}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
              >
                {linkedAccount.name}
              </Link>
            ) : null}
            {linkedProjectSummary ? (
              <Link
                href={`/projects/records/${linkedProjectSummary.id}`}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
              >
                {linkedProjectSummary.name}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <RecordEmailDialog
            kind="enquiry"
            recordId={enquiry.id}
            buttonLabel="Email discovery"
            dialogTitle="Email discovery summary"
            defaultRecipient={enquiry.contact_email}
            defaultSubject={`Discovery summary - ${enquiry.biz_name}`}
            defaultMessage={`Hi,\n\nPlease find the discovery summary for ${enquiry.biz_name} below.\n\nBest,\nRob`}
            buttonClassName="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          />
          {editing ? (
            <>
              <button
                type="button"
                onClick={saveChanges}
                disabled={saving}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setEditing(false)
                }}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetForm()
                setEditing(true)
              }}
              className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Edit submission
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Submission details</h2>
                <p className="text-sm text-slate-400">
                  Review and update the answers captured from discovery.
                </p>
              </div>
            </div>

            {editing ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as EnquiryStatus,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  >
                    {ENQUIRY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <SearchSelect
                  label="Linked account"
                  value={form.account_id}
                  options={accounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                    meta: account.website ?? account.industry ?? null,
                  }))}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      account_id: value,
                    }))
                  }
                  placeholder="Search accounts"
                  emptyLabel="No account"
                />

                <SearchSelect
                  label="Linked project"
                  value={form.project_id}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                    meta: project.account?.name ?? project.workstream?.label ?? null,
                  }))}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      project_id: value,
                    }))
                  }
                  placeholder="Search projects"
                  emptyLabel="No project"
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
                  <div className="mt-3">
                    <StatusBadge status={enquiry.status} kind="enquiry" />
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Linked account</p>
                  <div className="mt-3">
                    {linkedAccount ? (
                      <Link
                        href={`/crm/accounts/${linkedAccount.id}`}
                        className="text-sm text-sky-300 transition hover:text-sky-200"
                      >
                        {linkedAccount.name}
                      </Link>
                    ) : (
                      <p className="text-sm text-slate-200">—</p>
                    )}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Linked project</p>
                  <div className="mt-3">
                    {linkedProjectSummary ? (
                      <Link
                        href={`/projects/records/${linkedProjectSummary.id}`}
                        className="text-sm text-sky-300 transition hover:text-sky-200"
                      >
                        {linkedProjectSummary.name}
                      </Link>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-200">—</p>
                        <Link
                          href={createProjectHref}
                          className="inline-flex rounded-2xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
                        >
                          Create linked project
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {FIELD_CONFIG.map((field) => (
                <div key={field.key} className="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {field.label}
                  </p>
                  {editing
                    ? renderInput(field, form[field.key], (value) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: value,
                        }))
                      )
                    : renderAnswer(field.key, enquiry[field.key])}
                </div>
              ))}
            </div>
          </section>

          <details className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <summary className="cursor-pointer list-none text-lg font-semibold text-slate-100">
              Email thread
            </summary>
            <div className="mt-4">
              <EmailThread
                contact_id={enquiry.converted_contact_id}
                contact_email={enquiry.contact_email}
                account_id={enquiry.account_id}
                enquiry_id={enquiry.id}
                embedded
              />
            </div>
          </details>
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <EnquiryDetailActions
            enquiry={enquiry}
            generatedQuoteId={generatedQuoteId}
            generatedQuoteEmail={enquiry.contact_email}
            linkedProject={linkedProject}
            createProjectHref={createProjectHref}
          />
        </div>
      </div>
    </div>
  )
}
