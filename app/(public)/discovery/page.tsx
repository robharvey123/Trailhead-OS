'use client'

import { FormEvent, KeyboardEvent, useState } from 'react'
import type { EnquiryFormState } from '@/lib/types'

type StepKind = 'text' | 'textarea' | 'radio' | 'chips'

type StepDefinition = {
  field: keyof EnquiryFormState
  title: string
  kind: StepKind
  required: boolean
  placeholder?: string
  hint?: string
  options?: readonly string[]
}

const STEPS: StepDefinition[] = [
  {
    field: 'biz_name',
    title: 'What is the name of your business?',
    kind: 'text',
    required: true,
    placeholder: 'e.g. Apex Building Services Ltd',
  },
  {
    field: 'contact_name',
    title: 'Who should we speak to about this?',
    kind: 'text',
    required: true,
    placeholder: 'e.g. James Turner, Operations Manager',
  },
  {
    field: 'biz_type',
    title: 'Which of these best describes your business?',
    kind: 'radio',
    required: true,
    options: [
      'Construction/Building',
      'Electrical/Plumbing/HVAC',
      'Facilities Management',
      'Fire & Security',
      'Cleaning & Maintenance',
      'Other trade/field services',
    ],
  },
  {
    field: 'team_size',
    title: 'How big is the team using the system?',
    kind: 'radio',
    required: true,
    options: ['1–5', '6–15', '16–30', '30+'],
  },
  {
    field: 'team_split',
    title: 'How is that team split day to day?',
    kind: 'radio',
    required: true,
    options: [
      'Mostly engineers in the field',
      'Mostly office-based',
      'Roughly 50/50',
      'Mix varies week to week',
    ],
  },
  {
    field: 'top_features',
    title: 'Which features would matter most right away?',
    kind: 'chips',
    required: true,
    options: [
      'Shared team calendar',
      'Job/appointment scheduling',
      'Forms for engineers',
      'Project notes & job history',
      'File & document uploads',
      'Customer/client records',
      'Task management',
      'Photo uploads from site',
      'Notifications & reminders',
      'Invoice or quote generation',
      'Reporting & dashboards',
      'User roles & permissions',
    ],
  },
  {
    field: 'calendar_detail',
    title: 'How are appointments or jobs managed right now?',
    kind: 'radio',
    required: true,
    options: [
      'Mostly paper or whiteboard',
      'Shared spreadsheet or Google Calendar',
      'A booking/CRM system',
      'Scattered across emails and texts',
      'No real system',
    ],
  },
  {
    field: 'forms_detail',
    title: 'What forms do engineers currently complete?',
    kind: 'textarea',
    required: true,
    hint: 'e.g. job sheets, risk assessments, COSHH, timesheets — list anything you can think of',
  },
  {
    field: 'devices',
    title: 'What devices do engineers use?',
    kind: 'chips',
    required: true,
    options: [
      'Android phone',
      'iPhone',
      'Android tablet',
      'iPad',
      'Laptop',
      'They work from the office',
    ],
  },
  {
    field: 'offline_capability',
    title: 'Do they need the app to work with poor signal or offline?',
    kind: 'radio',
    required: true,
    options: ['Yes, often', 'Sometimes', 'Rarely', 'No — always connected'],
  },
  {
    field: 'existing_tools',
    title: 'Which tools or software are already in the mix?',
    kind: 'textarea',
    required: true,
    hint: "e.g. Xero, QuickBooks, Outlook, Simpro — even if it's just spreadsheets",
  },
  {
    field: 'pain_points',
    title: 'What is the biggest pain point you want to solve?',
    kind: 'textarea',
    required: true,
    hint: 'Be as specific as you like — the more detail the better',
  },
  {
    field: 'timeline',
    title: 'What does your ideal timeline look like?',
    kind: 'radio',
    required: true,
    options: [
      'As soon as possible',
      'Within 1–2 months',
      '3–6 months',
      'No fixed deadline',
    ],
  },
  {
    field: 'budget',
    title: 'Do you have a rough budget in mind?',
    kind: 'radio',
    required: false,
    options: [
      'Under £5,000',
      '£5,000–£15,000',
      '£15,000–£30,000',
      '£30,000+',
      'Not sure yet',
      'Prefer to discuss',
    ],
  },
  {
    field: 'extra',
    title: 'Anything else we should know before we speak?',
    kind: 'textarea',
    required: false,
    hint: "Extra context, must-haves, or things that haven't worked before",
  },
]

const INITIAL_FORM: EnquiryFormState = {
  biz_name: '',
  contact_name: '',
  biz_type: '',
  team_size: '',
  team_split: '',
  top_features: [],
  calendar_detail: '',
  forms_detail: '',
  devices: [],
  offline_capability: '',
  existing_tools: '',
  pain_points: '',
  timeline: '',
  budget: '',
  extra: '',
}

function isStepValid(step: StepDefinition, form: EnquiryFormState): boolean {
  const value = form[step.field]

  if (!step.required) {
    return true
  }

  if (step.kind === 'chips') {
    return Array.isArray(value) && value.length > 0
  }

  return typeof value === 'string' && value.trim().length > 0
}

function ProgressBar({ currentStep }: { currentStep: number }) {
  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="space-y-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eadfce]">
        <div
          className="h-full rounded-full bg-[#b76e42] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm tracking-[0.2em] text-[#8b7357]">
        {currentStep + 1} / {STEPS.length}
      </p>
    </div>
  )
}

export default function DiscoveryPage() {
  const [form, setForm] = useState<EnquiryFormState>(INITIAL_FORM)
  const [currentStep, setCurrentStep] = useState(0)
  const [shakeNonce, setShakeNonce] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1

  function updateField<T extends keyof EnquiryFormState>(
    field: T,
    value: EnquiryFormState[T]
  ) {
    setSubmitError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  function goBack() {
    setSubmitError('')
    setCurrentStep((index) => Math.max(0, index - 1))
  }

  async function submitForm(nextForm: EnquiryFormState) {
    setSubmitError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextForm),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      setIsComplete(true)
    } catch {
      setSubmitError(
        'Something went wrong. Please try again or email rob@trailheadholdings.com'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function advance() {
    if (!isStepValid(step, form)) {
      setShakeNonce((value) => value + 1)
      return
    }

    if (isLastStep) {
      await submitForm(form)
      return
    }

    setSubmitError('')
    setCurrentStep((index) => Math.min(STEPS.length - 1, index + 1))
  }

  async function skipOptionalStep() {
    const clearedValue = step.kind === 'chips' ? [] : ''
    const nextForm = {
      ...form,
      [step.field]: clearedValue,
    } as EnquiryFormState

    setForm(nextForm)
    setSubmitError('')

    if (isLastStep) {
      await submitForm(nextForm)
      return
    }

    setCurrentStep((index) => Math.min(STEPS.length - 1, index + 1))
  }

  function onAdvanceKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key !== 'Enter') {
      return
    }

    if (event.shiftKey) {
      return
    }

    event.preventDefault()
    void advance()
  }

  function renderStepField() {
    const value = form[step.field]

    if (step.kind === 'text') {
      return (
        <input
          autoFocus
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => updateField(step.field, event.target.value)}
          onKeyDown={onAdvanceKeyDown}
          placeholder={step.placeholder}
          className="w-full rounded-[1.75rem] border border-[#d9ccb9] bg-white px-5 py-4 text-lg text-[#1f2937] shadow-[0_20px_70px_rgba(148,163,184,0.12)] outline-none transition focus:border-[#b76e42] focus:ring-4 focus:ring-[#f2d7bf]"
        />
      )
    }

    if (step.kind === 'textarea') {
      return (
        <textarea
          autoFocus
          rows={6}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => updateField(step.field, event.target.value)}
          onKeyDown={onAdvanceKeyDown}
          placeholder={step.hint}
          className="min-h-40 w-full rounded-[1.75rem] border border-[#d9ccb9] bg-white px-5 py-4 text-lg text-[#1f2937] shadow-[0_20px_70px_rgba(148,163,184,0.12)] outline-none transition focus:border-[#b76e42] focus:ring-4 focus:ring-[#f2d7bf]"
        />
      )
    }

    if (step.kind === 'radio') {
      return (
        <div className="space-y-3">
          {step.options?.map((option) => {
            const selected = value === option

            return (
              <button
                key={option}
                type="button"
                onClick={() => updateField(step.field, option)}
                className={`flex min-h-12 w-full items-center justify-between rounded-[1.4rem] border px-4 py-4 text-left text-base transition sm:text-lg ${
                  selected
                    ? 'border-[#b76e42] bg-[#fff7ef] text-[#6f3f1f] shadow-[0_18px_45px_rgba(183,110,66,0.15)]'
                    : 'border-[#dbcdbb] bg-white text-[#334155] hover:border-[#c99a77] hover:bg-[#fffaf4]'
                }`}
              >
                <span>{option}</span>
                <span
                  className={`h-5 w-5 rounded-full border ${
                    selected
                      ? 'border-[#b76e42] bg-[#b76e42] ring-4 ring-[#f3dec8]'
                      : 'border-[#cbb8a1] bg-white'
                  }`}
                />
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <div className="flex flex-wrap gap-3">
        {step.options?.map((option) => {
          const selected = Array.isArray(value) && value.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                const currentValues = Array.isArray(value) ? value : []
                const nextValues = selected
                  ? currentValues.filter((item) => item !== option)
                  : [...currentValues, option]
                updateField(step.field, nextValues)
              }}
              className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition sm:text-base ${
                selected
                  ? 'border-[#b76e42] bg-[#fff3e3] text-[#7a451f] shadow-[0_16px_34px_rgba(183,110,66,0.16)]'
                  : 'border-[#d8c9b4] bg-white text-[#475569] hover:border-[#c99a77] hover:bg-[#fffaf4]'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await advance()
  }

  if (isComplete) {
    return (
      <section className="flex min-h-[calc(100svh-4.5rem)] items-center justify-center py-10">
        <div className="w-full max-w-3xl rounded-[2rem] border border-[#d8cbb9] bg-white/90 p-6 shadow-[0_28px_90px_rgba(148,163,184,0.18)] backdrop-blur sm:p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[#8b7357]">Discovery sent</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#1f2937] sm:text-4xl">
            All done — thank you!
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#475569] sm:text-lg">
            We&apos;ll be in touch shortly to talk through your requirements.
          </p>

          <div className="mt-8 grid gap-4 rounded-[1.5rem] border border-[#e5d8c7] bg-[#fcfaf6] p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#9a8060]">Business</p>
              <p className="mt-2 text-base font-medium text-[#1f2937]">{form.biz_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#9a8060]">Team size</p>
              <p className="mt-2 text-base font-medium text-[#1f2937]">{form.team_size || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#9a8060]">Top features</p>
              <p className="mt-2 text-base font-medium text-[#1f2937]">
                {form.top_features.slice(0, 3).join(', ') || '—'}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-[calc(100svh-4.5rem)] items-center py-6 sm:py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="max-w-xl space-y-6">
          <ProgressBar currentStep={currentStep} />
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.26em] text-[#9a8060]">
              Trailhead discovery
            </p>
            <h1 className="text-[2rem] leading-tight text-[#1f2937] sm:text-[2.5rem]">
              Built for teams that need jobs, people, paperwork, and schedules to stay in sync.
            </h1>
            <p className="max-w-lg text-base leading-7 text-[#526072] sm:text-lg">
              A few quick questions will help shape the first conversation around your workflow, field team, and the operational gaps worth fixing first.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-[#dccfbf] bg-white/90 p-5 shadow-[0_28px_90px_rgba(148,163,184,0.18)] backdrop-blur sm:p-8"
        >
          <div
            key={currentStep}
            className="animate-os-step-enter flex min-h-[56svh] flex-col justify-between gap-8"
          >
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-[#eadcc8] bg-[#fbf7f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[#977553]">
                {step.required ? 'Required' : 'Optional'}
              </div>
              <div className="space-y-3">
                <h2 className="text-[1.75rem] leading-tight text-[#14202e] sm:text-[2.1rem]">
                  {step.title}
                </h2>
                {step.hint && step.kind !== 'textarea' ? (
                  <p className="text-sm leading-6 text-[#6b7280] sm:text-base">{step.hint}</p>
                ) : null}
                {step.kind === 'chips' && step.required ? (
                  <p className="text-sm leading-6 text-[#6b7280] sm:text-base">
                    Select at least one option.
                  </p>
                ) : null}
              </div>
              <div className="pt-2">{renderStepField()}</div>
            </div>

            <div className="space-y-4 border-t border-[#eee3d4] pt-5">
              {submitError ? (
                <p className="rounded-2xl border border-[#e2b8b1] bg-[#fff3f1] px-4 py-3 text-sm text-[#a23c33]">
                  {submitError}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d3c4af] px-4 text-sm font-medium text-[#5a6472] transition hover:border-[#b89271] hover:text-[#2f3a48]"
                    >
                      Back
                    </button>
                  ) : null}

                  {!step.required ? (
                    <button
                      type="button"
                      onClick={() => void skipOptionalStep()}
                      className="inline-flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-medium text-[#8b7357] transition hover:text-[#6f5536]"
                    >
                      Skip
                    </button>
                  ) : null}
                </div>

                <button
                  key={`${currentStep}-${shakeNonce}`}
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex min-h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-[#b76e42] px-5 text-sm font-semibold text-white transition hover:bg-[#9f5d35] disabled:cursor-not-allowed disabled:opacity-70 ${
                    shakeNonce > 0 ? 'animate-os-shake' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{isLastStep ? 'Submit' : 'Next'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
