'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.4-8l-6.5 5C9.4 39.5 16.1 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C36.9 39.1 44 34 44 24c0-1.3-.1-2.3-.4-3.5Z"
      />
    </svg>
  )
}

function StripeIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <rect x="6" y="10" width="52" height="44" rx="12" fill="#635BFF" />
      <path
        fill="#fff"
        d="M34.6 27.2c-3.1-1-4.7-1.6-4.7-3.2 0-1.3 1.1-2.2 3.1-2.2 2.2 0 4.5.7 6.6 1.9v-6.1c-1.8-.9-4.1-1.5-6.8-1.5-5.5 0-9.2 3.2-9.2 8 0 5.2 4.2 7 7.5 8.1 3.3 1.1 4.5 1.8 4.5 3.3s-1.2 2.4-3.4 2.4c-2.5 0-5.2-.8-7.7-2.4v6.2c2.2 1.1 5 1.7 7.9 1.7 6 0 9.9-3 9.9-8.1 0-5.4-4.3-7.2-7.7-8.1Z"
      />
    </svg>
  )
}

function StatusBadge({
  connected,
  label,
}: {
  connected: boolean
  label: string
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        connected
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          : 'border-slate-700 bg-slate-950/70 text-slate-300'
      }`}
    >
      {label}
    </span>
  )
}

type SettingsIntegrationsProps = {
  initialGoogleEmail: string | null
  paidInvoicesThisMonth: number
}

export default function SettingsIntegrations({
  initialGoogleEmail,
  paidInvoicesThisMonth,
}: SettingsIntegrationsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [googleEmail, setGoogleEmail] = useState(initialGoogleEmail)
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null)
  const [stripeCurrency, setStripeCurrency] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  useEffect(() => {
    const googleState = searchParams.get('google')
    if (googleState === 'connected') {
      toast.success('Google Workspace connected')
    }
    if (googleState === 'disconnected') {
      toast.success('Google Workspace disconnected')
    }
    if (googleState === 'error') {
      toast.error('Google Workspace connection failed')
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    async function loadStripeStatus() {
      try {
        const response = await fetch('/api/stripe/status')
        const data = await response.json()
        if (!cancelled) {
          setStripeConnected(Boolean(data.connected))
          setStripeCurrency(data.currency ?? null)
        }
      } catch {
        if (!cancelled) {
          setStripeConnected(false)
          setStripeCurrency(null)
        }
      }
    }

    void loadStripeStatus()

    return () => {
      cancelled = true
    }
  }, [])

  const googleConnected = Boolean(googleEmail)
  const stripeBadgeLabel = useMemo(() => {
    if (stripeConnected === null) {
      return 'Checking...'
    }
    return stripeConnected ? 'Connected' : 'Not connected'
  }, [stripeConnected])

  async function syncCalendar() {
    setLoadingAction('calendar')
    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both', days: 30 }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Calendar sync failed')
      }
      toast.success(`Calendar synced: ${data.pushed ?? 0} pushed, ${data.pulled ?? 0} pulled`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Calendar sync failed')
    } finally {
      setLoadingAction(null)
    }
  }

  async function syncEmails() {
    setLoadingAction('emails')
    try {
      const response = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Email sync failed')
      }
      toast.success(`Email sync complete: ${data.synced ?? 0} messages processed`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Email sync failed')
    } finally {
      setLoadingAction(null)
    }
  }

  async function disconnectGoogle() {
    setLoadingAction('disconnect')
    try {
      const response = await fetch('/api/auth/google/disconnect', { method: 'POST' })
      if (!response.ok) {
        throw new Error('Failed to disconnect Google Workspace')
      }
      setGoogleEmail(null)
      toast.success('Google Workspace disconnected')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to disconnect Google Workspace'
      )
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Integrations</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">External services</h2>
        <p className="mt-2 text-sm text-slate-400">
          Connect Google Workspace and Stripe to sync communication, calendars, and payments.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <GoogleIcon />
              <div>
                <h3 className="text-base font-semibold text-slate-100">Google Workspace</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Sync Gmail and Google Calendar
                </p>
              </div>
            </div>
            <StatusBadge
              connected={googleConnected}
              label={googleConnected ? 'Connected' : 'Not connected'}
            />
          </div>

          <div className="mt-5 space-y-3">
            {googleConnected ? (
              <>
                <p className="text-sm text-slate-200">{googleEmail}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void syncCalendar()}
                    disabled={loadingAction !== null}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    {loadingAction === 'calendar' ? 'Syncing...' : 'Sync calendar now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void syncEmails()}
                    disabled={loadingAction !== null}
                    className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                  >
                    {loadingAction === 'emails' ? 'Syncing...' : 'Sync emails now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void disconnectGoogle()}
                    disabled={loadingAction !== null}
                    className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
                  >
                    {loadingAction === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/api/auth/google"
                className="inline-flex rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Connect Google
              </Link>
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <StripeIcon />
              <div>
                <h3 className="text-base font-semibold text-slate-100">Stripe Payments</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Send payment links and track payments
                </p>
              </div>
            </div>
            <StatusBadge connected={Boolean(stripeConnected)} label={stripeBadgeLabel} />
          </div>

          <div className="mt-5 space-y-3">
            {stripeConnected ? (
              <>
                <p className="text-sm text-slate-200">Payments enabled</p>
                <p className="text-sm text-slate-400">
                  Paid invoices this month: {paidInvoicesThisMonth}
                  {stripeCurrency ? ` · ${stripeCurrency.toUpperCase()}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  Add Stripe keys in Netlify environment variables.
                </p>
                <Link
                  href="https://docs.netlify.com/environment-variables/overview/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm text-sky-300 transition hover:text-sky-200"
                >
                  Open Netlify docs
                </Link>
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
