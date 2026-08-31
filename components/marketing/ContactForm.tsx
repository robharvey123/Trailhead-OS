'use client'

import PlanIcon from '@/components/marketing/PlanIcon'

import { useState, type FormEvent } from 'react'

// Fields are ticket stock in an ink rule: square, printed, no shadow. Focus is
// the price-flash red, so the caret and the ring belong to the same palette as
// every other action on the site.
const fieldClassName =
  'w-full border border-[var(--hair)] bg-[var(--card)] px-3.5 py-3 plan-body-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] hover:border-[var(--ink-2)] focus:border-[var(--flash)]'

const labelClassName = 'plan-label mb-2 block text-[var(--ink-2)]'

export type ContactTrack = 'commercial' | 'studio' | 'labs'

// The interest dropdown mirrors the three tracks so an enquiry arrives
// already sorted, and the referring page preselects it, so the visitor never
// has to translate their problem into our org chart.
const interestOptions = [
  'Consulting, Trailhead Commercial',
  'Software build, Trailhead Studio',
  'Products, Trailhead Labs',
  'Other',
]

const trackToInterest: Record<ContactTrack, string> = {
  commercial: interestOptions[0],
  studio: interestOptions[1],
  labs: interestOptions[2],
}

export default function ContactForm({ track }: { track?: ContactTrack }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [interest, setInterest] = useState(
    track ? trackToInterest[track] : interestOptions[0]
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  // Honeypot: hidden from users, tempting to bots. Non-empty on submit → spam.
  const [website, setWebsite] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          interest,
          track,
          message,
          website,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(
          payload.error || 'Something went wrong. Please try again.'
        )
      }

      setSuccess(true)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="ticket">
        <p className="plan-data text-[var(--ink-3)]">ENQUIRY LOGGED</p>
        <h3 className="plan-h3 mt-3">Thanks, we&apos;ll be in touch shortly.</h3>
        <p className="plan-body ticket-rule plan-body-sm">
          Your message is with us. We&apos;ll come back to you as soon as we
          can.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[var(--ink)] bg-[var(--plan)] p-5 md:p-7"
    >
      {/* Honeypot: hidden off-screen (not display:none, which some bots skip). */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="grid gap-4">
        <div>
          <label
            htmlFor="contact-name"
            className={labelClassName}
          >
            Name
          </label>
          <input
            id="contact-name"
            className={fieldClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="contact-email"
            className={labelClassName}
          >
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            className={fieldClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="contact-company"
            className={labelClassName}
          >
            Company
          </label>
          <input
            id="contact-company"
            className={fieldClassName}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="contact-interest"
            className={labelClassName}
          >
            What are you looking for?
          </label>
          <select
            id="contact-interest"
            className={fieldClassName}
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
          >
            {interestOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="contact-message"
            className={labelClassName}
          >
            Message
          </label>
          <textarea
            id="contact-message"
            className={`${fieldClassName} min-h-40 resize-y`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 border border-[var(--flash)] bg-[var(--card)] px-3.5 py-3 plan-body-xs text-[var(--flash)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flash mt-6 w-full justify-between disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Send message'}
        {submitting ? null : <PlanIcon name="right" />}
      </button>
    </form>
  )
}
