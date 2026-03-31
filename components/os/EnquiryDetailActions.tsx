'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import PricingTierSelector from './PricingTierSelector'
import RecordEmailDialog from './RecordEmailDialog'
import StatusBadge from './StatusBadge'
import type { Enquiry, PricingTier, ProjectDetail, QuoteScope } from '@/lib/types'

type QuoteGuidanceState = {
  pricingPosture: 'conservative' | 'balanced' | 'assertive'
  budgetAlignment: 'respect' | 'flexible' | 'value'
  deliveryBias: 'best_fit' | 'fixed' | 'milestone' | 'time_and_materials'
  mustInclude: string
  mustAvoid: string
  notes: string
}

const DEFAULT_GUIDANCE: QuoteGuidanceState = {
  pricingPosture: 'balanced',
  budgetAlignment: 'respect',
  deliveryBias: 'best_fit',
  mustInclude: '',
  mustAvoid: '',
  notes: '',
}

function createEmptyPhase(): QuoteScope {
  return {
    phase: '',
    description: '',
    deliverables: [],
    duration: 'TBC',
  }
}

function mapProjectPhases(project: ProjectDetail | null): QuoteScope[] {
  if (!project || project.phases.length === 0) {
    return [
      {
        phase: 'Discovery',
        description: 'Clarify scope and delivery approach.',
        deliverables: [],
        duration: 'TBC',
      },
      {
        phase: 'Delivery',
        description: 'Build the agreed core deliverables.',
        deliverables: [],
        duration: 'TBC',
      },
      {
        phase: 'Launch',
        description: 'Review, handover, and launch.',
        deliverables: [],
        duration: 'TBC',
      },
    ]
  }

  return project.phases.map((phase) => ({
    phase: phase.name,
    description: phase.description ?? 'Details to be confirmed.',
    deliverables: [],
    duration:
      phase.start_date && phase.end_date
        ? `${phase.start_date} to ${phase.end_date}`
        : 'TBC',
  }))
}

function deliverablesToText(deliverables: string[]) {
  return deliverables.join('\n')
}

function parseDeliverables(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildContactNotes(enquiry: Enquiry) {
  const sections = [
    `Converted from enquiry ${enquiry.id}`,
    enquiry.pain_points ? `Pain points: ${enquiry.pain_points}` : null,
    enquiry.timeline ? `Timeline: ${enquiry.timeline}` : null,
    enquiry.budget ? `Budget: ${enquiry.budget}` : null,
    enquiry.extra ? `Extra: ${enquiry.extra}` : null,
  ].filter(Boolean)

  return sections.join('\n')
}

export default function EnquiryDetailActions({
  enquiry,
  generatedQuoteId,
  generatedQuoteEmail,
  linkedProject,
  createProjectHref,
}: {
  enquiry: Enquiry
  generatedQuoteId: string | null
  generatedQuoteEmail: string | null
  linkedProject: ProjectDetail | null
  createProjectHref: string
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<'review' | 'convert' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [revisionScope, setRevisionScope] = useState<QuoteScope[]>(() => mapProjectPhases(linkedProject))
  const [guidance, setGuidance] = useState<QuoteGuidanceState>(DEFAULT_GUIDANCE)

  useEffect(() => {
    if (!showGenerateModal) {
      return
    }

    setRevisionScope(mapProjectPhases(linkedProject))
    setGuidance(DEFAULT_GUIDANCE)
  }, [linkedProject, showGenerateModal])

  async function handleMarkReviewed() {
    setLoadingAction('review')
    setError(null)

    try {
      await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewed' }),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark enquiry as reviewed')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleConvert() {
    setLoadingAction('convert')
    setError(null)

    try {
      const { contact } = await apiFetch<{ contact: { id: string } }>(
        '/api/contacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: enquiry.contact_name,
            company: enquiry.biz_name,
            email: enquiry.contact_email,
            phone: enquiry.contact_phone,
            notes: buildContactNotes(enquiry),
            status: 'lead',
          }),
        }
      )

      await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'converted',
          converted_contact_id: contact.id,
        }),
      })

      router.push(`/crm/contacts/${contact.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert enquiry')
      setLoadingAction(null)
    }
  }

  async function handleGenerateQuote() {
    if (!linkedProject) {
      setGenerateError('Link this enquiry to a project before generating a revised quote.')
      return
    }

    setLoadingAction('generate')
    setGenerateError(null)

    const scopeOverride = revisionScope
      .map((phase) => ({
        phase: phase.phase.trim(),
        description: phase.description.trim(),
        deliverables: phase.deliverables.map((deliverable) => deliverable.trim()).filter(Boolean),
        duration: phase.duration.trim(),
      }))
      .filter((phase) => phase.phase && phase.description && phase.duration)

    if (scopeOverride.length === 0) {
      setGenerateError('Add at least one valid project stage before generating the quote.')
      setLoadingAction(null)
      return
    }

    try {
      const response = await apiFetch<{ quote_id: string }>(
        '/api/quotes/ai-draft',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enquiry_id: enquiry.id,
            project_id: linkedProject.id,
            pricing_tier_id: selectedTier?.id,
            scope_override: scopeOverride,
            sync_project_scope: true,
            create_new_version: true,
            guidance: {
              pricing_posture: guidance.pricingPosture,
              budget_alignment: guidance.budgetAlignment,
              delivery_bias: guidance.deliveryBias,
              must_include: guidance.mustInclude,
              must_avoid: guidance.mustAvoid,
              notes: guidance.notes,
            },
          }),
        }
      )

      setShowGenerateModal(false)
      router.push(`/quotes/${response.quote_id}`)
      router.refresh()
    } catch (generateError) {
      setGenerateError(
        generateError instanceof Error ? generateError.message : 'Failed to generate quote'
      )
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Status</p>
        <StatusBadge
          status={enquiry.status}
          kind="enquiry"
          className="mt-4"
        />
        <div className="mt-6 space-y-3">
          {linkedProject ? (
            <Link
              href={`/projects/records/${linkedProject.id}`}
              className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              View linked project
            </Link>
          ) : (
            <Link
              href={createProjectHref}
              className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Create linked project
            </Link>
          )}

          {generatedQuoteId ? (
            <>
              <Link
                href={`/quotes/${generatedQuoteId}`}
                className="block rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center text-sm font-semibold text-sky-100 transition hover:border-sky-400"
              >
                View generated quote →
              </Link>
              <RecordEmailDialog
                kind="quote"
                recordId={generatedQuoteId}
                buttonLabel="Email generated quote"
                dialogTitle="Email generated quote"
                defaultRecipient={generatedQuoteEmail}
                defaultSubject={`Quote for ${enquiry.biz_name}`}
                defaultMessage={`Hi,\n\nPlease find the attached quote for ${enquiry.biz_name}.\n\nBest,\nRob`}
                buttonClassName="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                fullWidth
              />
              <button
                type="button"
                onClick={() => {
                  setGenerateError(null)
                  setShowGenerateModal(true)
                }}
                disabled={loadingAction !== null}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-400 disabled:opacity-60"
              >
                Revise stages and generate new quote
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setGenerateError(null)
                  setShowGenerateModal(true)
                }}
                disabled={loadingAction !== null}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-400 disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
                </svg>
                Generate scope & quote with AI
              </button>
            </>
          )}
          {enquiry.status === 'new' ? (
            <button
              type="button"
              onClick={handleMarkReviewed}
              disabled={loadingAction !== null}
              className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 disabled:opacity-60"
            >
              {loadingAction === 'review' ? 'Marking...' : 'Mark as reviewed'}
            </button>
          ) : null}

          {enquiry.converted_contact_id ? (
            <Link
              href={`/crm/contacts/${enquiry.converted_contact_id}`}
              className="block rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              View converted contact
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={loadingAction !== null}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {loadingAction === 'convert' ? 'Converting...' : 'Convert to contact'}
            </button>
          )}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Meta</p>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-slate-500">Enquiry ID</dt>
            <dd className="mt-1 text-slate-200">{enquiry.id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Submitted</dt>
            <dd className="mt-1 text-slate-200">
              {new Date(enquiry.created_at).toLocaleString('en-GB')}
            </dd>
          </div>
        </dl>
      </section>

      {showGenerateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-5xl rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-50">Select pricing tier</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Review the linked project stages, then choose the pricing tier for the new quote.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (loadingAction === 'generate') {
                    return
                  }
                  setShowGenerateModal(false)
                }}
                className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                disabled={loadingAction === 'generate'}
              >
                Close
              </button>
            </div>

            <div className="mt-6">
              {linkedProject ? (
                <div className="mb-6 rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">Project stages</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        These stages will update the linked project and drive the new quote scope.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevisionScope((current) => [...current, createEmptyPhase()])}
                      className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                    >
                      Add stage
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {revisionScope.map((phase, index) => (
                      <div key={`${phase.phase}-${index}`} className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Stage {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevisionScope((current) =>
                                current.length === 1 ? current : current.filter((_, phaseIndex) => phaseIndex !== index)
                              )
                            }
                            className="rounded-2xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                          <label className="space-y-2">
                            <span className="text-sm text-slate-300">Stage name</span>
                            <input
                              value={phase.phase}
                              onChange={(event) =>
                                setRevisionScope((current) =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, phase: event.target.value } : entry
                                  )
                                )
                              }
                              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-sm text-slate-300">Duration</span>
                            <input
                              value={phase.duration}
                              onChange={(event) =>
                                setRevisionScope((current) =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, duration: event.target.value } : entry
                                  )
                                )
                              }
                              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                            />
                          </label>
                        </div>

                        <label className="mt-4 block space-y-2">
                          <span className="text-sm text-slate-300">Description</span>
                          <textarea
                            value={phase.description}
                            onChange={(event) =>
                              setRevisionScope((current) =>
                                current.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, description: event.target.value } : entry
                                )
                              )
                            }
                            rows={3}
                            className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                          />
                        </label>

                        <label className="mt-4 block space-y-2">
                          <span className="text-sm text-slate-300">Deliverables</span>
                          <textarea
                            value={deliverablesToText(phase.deliverables)}
                            onChange={(event) =>
                              setRevisionScope((current) =>
                                current.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, deliverables: parseDeliverables(event.target.value) }
                                    : entry
                                )
                              )
                            }
                            rows={3}
                            className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                          />
                          <p className="text-xs text-slate-500">Use one deliverable per line or separate with commas.</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Link the enquiry to a project first so stage revisions can stay tied to the delivery plan.
                </div>
              )}

              <PricingTierSelector
                value={selectedTier?.id ?? null}
                onChange={setSelectedTier}
              />

              <div className="mt-6 rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Quote guidance</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Set commercial guardrails before the quote is generated.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Pricing posture</span>
                    <select
                      value={guidance.pricingPosture}
                      onChange={(event) =>
                        setGuidance((current) => ({
                          ...current,
                          pricingPosture: event.target.value as QuoteGuidanceState['pricingPosture'],
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    >
                      <option value="conservative">Conservative</option>
                      <option value="balanced">Balanced</option>
                      <option value="assertive">Assertive</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Budget handling</span>
                    <select
                      value={guidance.budgetAlignment}
                      onChange={(event) =>
                        setGuidance((current) => ({
                          ...current,
                          budgetAlignment: event.target.value as QuoteGuidanceState['budgetAlignment'],
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    >
                      <option value="respect">Stay close to stated budget</option>
                      <option value="flexible">Treat budget as soft guidance</option>
                      <option value="value">Optimise for best value, even if above budget</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Delivery model</span>
                    <select
                      value={guidance.deliveryBias}
                      onChange={(event) =>
                        setGuidance((current) => ({
                          ...current,
                          deliveryBias: event.target.value as QuoteGuidanceState['deliveryBias'],
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    >
                      <option value="best_fit">Let the model choose</option>
                      <option value="fixed">Bias toward fixed price</option>
                      <option value="milestone">Bias toward milestone billing</option>
                      <option value="time_and_materials">Bias toward time and materials</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Must include</span>
                    <textarea
                      value={guidance.mustInclude}
                      onChange={(event) =>
                        setGuidance((current) => ({ ...current, mustInclude: event.target.value }))
                      }
                      rows={4}
                      placeholder="Examples: discovery workshop, training, hosting, phased rollout"
                      className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Must avoid</span>
                    <textarea
                      value={guidance.mustAvoid}
                      onChange={(event) =>
                        setGuidance((current) => ({ ...current, mustAvoid: event.target.value }))
                      }
                      rows={4}
                      placeholder="Examples: mobile app, deep integrations, admin portal in v1"
                      className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm text-slate-300">Additional notes</span>
                  <textarea
                    value={guidance.notes}
                    onChange={(event) =>
                      setGuidance((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={4}
                    placeholder="Anything commercial or delivery-specific you want the quote to reflect."
                    className="w-full rounded-[1.25rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="min-h-6">
                {loadingAction === 'generate' ? (
                  <div className="flex items-center gap-3 text-sm text-sky-100">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-100/30 border-t-sky-100" />
                    Claude is analysing the enquiry and building your quote...
                  </div>
                ) : null}
                {generateError ? (
                  <p className="text-sm text-rose-300">{generateError}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleGenerateQuote}
                disabled={!selectedTier || loadingAction === 'generate'}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {loadingAction === 'generate' ? 'Generating quote...' : 'Generate quote'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
