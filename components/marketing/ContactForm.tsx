'use client'

import { useState, type FormEvent } from 'react'

const fieldClassName =
  'w-full rounded-2xl border border-[var(--marketing-border)] bg-white px-4 py-3 text-[0.98rem] text-[var(--marketing-text)] outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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
      <div className="rounded-[2rem] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-8">
        <h3 className="text-2xl font-bold tracking-[-0.03em]">
          Thanks, we&apos;ll be in touch shortly.
        </h3>
        <p className="mt-3 text-slate-600">
          Your message is with us. We&apos;ll come back to you as soon as we
          can.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.28)] md:p-8"
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

      <div className="grid gap-5">
        <div>
          <label
            htmlFor="contact-name"
            className="mb-2 block text-sm font-semibold text-slate-700"
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
            className="mb-2 block text-sm font-semibold text-slate-700"
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
            className="mb-2 block text-sm font-semibold text-slate-700"
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
            className="mb-2 block text-sm font-semibold text-slate-700"
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
            className="mb-2 block text-sm font-semibold text-slate-700"
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
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Sending...' : 'Send message'}
      </button>
    </form>
  )
}
