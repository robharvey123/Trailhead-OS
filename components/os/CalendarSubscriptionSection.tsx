'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Workstream } from '@/lib/types'

type Props = {
  appUrl: string
  icalSecret: string
  workstreams: Workstream[]
}

function maskToken(token: string) {
  if (token.length <= 8) {
    return token
  }

  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`
}

function withWorkstream(url: string, slug: string) {
  return `${url}&workstream=${encodeURIComponent(slug)}`
}

export default function CalendarSubscriptionSection({ appUrl, icalSecret, workstreams }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const baseWebcalUrl = useMemo(() => {
    const normalized = appUrl.replace(/\/$/, '')
    return normalized.replace(/^https?:\/\//, 'webcal://')
  }, [appUrl])

  const fullUrl = `${baseWebcalUrl}/api/calendar/ical?token=${icalSecret}`
  const maskedUrl = `${baseWebcalUrl}/api/calendar/ical?token=${maskToken(icalSecret)}`

  useEffect(() => {
    if (!copiedKey) {
      return
    }

    const timeout = window.setTimeout(() => setCopiedKey(null), 2000)
    return () => window.clearTimeout(timeout)
  }, [copiedKey])

  async function copyUrl(url: string, key: string) {
    await navigator.clipboard.writeText(url)
    setCopiedKey(key)
  }

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Calendar</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-100">
        Subscribe in Apple Calendar (or any calendar app)
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">
        Add your Trailhead OS calendar to Apple Calendar, Outlook, or any app that supports iCal subscriptions.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Subscription URL</label>
          <input
            readOnly
            value={maskedUrl}
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copyUrl(fullUrl, 'main')}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
          >
            {copiedKey === 'main' ? 'Copied!' : 'Copy URL'}
          </button>
          <button
            type="button"
            onClick={() => window.open(fullUrl)}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
          >
            Open in Apple Calendar
          </button>
        </div>

        <details className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-medium text-slate-100">How to subscribe</summary>
          <div className="mt-4 space-y-4 text-slate-400">
            <div>
              <p className="font-medium text-slate-200">iPhone/iPad</p>
              <p>1. Tap &quot;Copy URL&quot; above</p>
              <p>2. Go to Settings → Calendar → Accounts → Add Account</p>
              <p>3. Tap &quot;Other&quot; → &quot;Add Subscribed Calendar&quot;</p>
              <p>4. Paste the URL and tap Next</p>
              <p>5. Tap Save</p>
            </div>
            <div>
              <p className="font-medium text-slate-200">Mac</p>
              <p>1. Click &quot;Open in Apple Calendar&quot; above</p>
              <p>2. Click Subscribe in the dialog that opens</p>
              <p>3. Click OK</p>
            </div>
            <div>
              <p className="font-medium text-slate-200">Google Calendar</p>
              <p>1. Copy the URL and change `webcal://` to `https://`</p>
              <p>2. In Google Calendar: Other calendars → + → From URL</p>
              <p>3. Paste and click Add calendar</p>
            </div>
            <div>
              <p className="font-medium text-slate-200">Outlook</p>
              <p>1. Copy the URL</p>
              <p>2. In Outlook: Add calendar → Subscribe from web</p>
              <p>3. Paste and click Import</p>
            </div>
          </div>
        </details>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm font-medium text-slate-100">Or subscribe to a single workstream:</p>
          <div className="mt-4 space-y-3">
            {workstreams.slice(0, 5).map((workstream) => {
              const workstreamUrl = withWorkstream(fullUrl, workstream.slug)
              const maskedWorkstreamUrl = withWorkstream(maskedUrl, workstream.slug)
              const copyKey = `workstream-${workstream.slug}`

              return (
                <div
                  key={workstream.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{workstream.label}</p>
                      <p className="mt-1 break-all text-xs text-slate-400">{maskedWorkstreamUrl}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyUrl(workstreamUrl, copyKey)}
                      className="rounded-2xl border border-slate-700 px-3 py-2 text-xs text-slate-100 transition hover:border-slate-500"
                    >
                      {copiedKey === copyKey ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
