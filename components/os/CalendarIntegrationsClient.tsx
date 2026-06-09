'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import ConfirmDialog from './ConfirmDialog'

interface GoogleAccount {
  id: string
  email: string
  label: string | null
  created_at: string
  needs_reconnect?: boolean
}

interface GoogleCalendarItem {
  id: string
  summary: string
  description: string | null
  backgroundColor: string | null
  primary: boolean
  accessRole: string
  enabled: boolean
  sync_direction: 'push' | 'pull' | 'both'
  selection_id: string | null
}

interface MicrosoftAccount {
  id: string
  email: string
  label: string | null
  created_at: string
}

interface MicrosoftCalendarItem {
  id: string
  name: string
  colour: string | null
  isDefaultCalendar: boolean
  canEdit: boolean
  enabled: boolean
  sync_direction: 'push' | 'pull' | 'both'
  selection_id: string | null
}

interface CalendarFeed {
  id: string
  name: string
  url: string
  colour: string
  enabled: boolean
  refresh_minutes: number
  last_fetched_at: string | null
  last_error: string | null
  event_count: number
  created_at: string
}

const FEED_COLOURS = [
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Teal', value: '#14B8A6' },
]

export default function CalendarIntegrationsClient({
  googleAccounts: initialGoogleAccounts,
  microsoftAccounts: initialMicrosoftAccounts,
  feeds: initialFeeds,
}: {
  googleAccounts: GoogleAccount[]
  microsoftAccounts: MicrosoftAccount[]
  feeds: CalendarFeed[]
}) {
  const [googleAccounts] = useState(initialGoogleAccounts)
  const [microsoftAccounts] = useState(initialMicrosoftAccounts)
  const [feeds, setFeeds] = useState(initialFeeds)
  const [deleteFeedId, setDeleteFeedId] = useState<string | null>(null)
  const [deleteFeedLoading, setDeleteFeedLoading] = useState(false)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [calendarLists, setCalendarLists] = useState<
    Record<string, GoogleCalendarItem[]>
  >({})
  const [loadingCalendars, setLoadingCalendars] = useState<string | null>(null)
  const [savingCalendars, setSavingCalendars] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done'>(
    'idle'
  )
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Feed form state
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [feedColour, setFeedColour] = useState(FEED_COLOURS[0].value)
  const [feedSaving, setFeedSaving] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)

  // Microsoft state
  const [expandedMsAccount, setExpandedMsAccount] = useState<string | null>(null)
  const [msCalendarLists, setMsCalendarLists] = useState<
    Record<string, MicrosoftCalendarItem[]>
  >({})
  const [loadingMsCalendars, setLoadingMsCalendars] = useState<string | null>(null)
  const [savingMsCalendars, setSavingMsCalendars] = useState(false)

  async function loadCalendarsForMsAccount(tokenId: string) {
    if (expandedMsAccount === tokenId) {
      setExpandedMsAccount(null)
      return
    }

    setLoadingMsCalendars(tokenId)
    setExpandedMsAccount(tokenId)

    try {
      const response = await apiFetch<{ calendars: MicrosoftCalendarItem[] }>(
        `/api/calendar/microsoft/${tokenId}/calendars`
      )
      setMsCalendarLists((prev) => ({
        ...prev,
        [tokenId]: response.calendars,
      }))
    } catch {
      setMsCalendarLists((prev) => ({ ...prev, [tokenId]: [] }))
    } finally {
      setLoadingMsCalendars(null)
    }
  }

  function toggleMsCalendar(tokenId: string, calendarId: string) {
    setMsCalendarLists((prev) => ({
      ...prev,
      [tokenId]: (prev[tokenId] ?? []).map((cal) =>
        cal.id === calendarId ? { ...cal, enabled: !cal.enabled } : cal
      ),
    }))
  }

  function setMsSyncDirection(
    tokenId: string,
    calendarId: string,
    direction: 'push' | 'pull' | 'both'
  ) {
    setMsCalendarLists((prev) => ({
      ...prev,
      [tokenId]: (prev[tokenId] ?? []).map((cal) =>
        cal.id === calendarId ? { ...cal, sync_direction: direction } : cal
      ),
    }))
  }

  async function saveMsCalendarSelections(tokenId: string) {
    setSavingMsCalendars(true)
    const calendars = msCalendarLists[tokenId] ?? []

    try {
      await apiFetch(`/api/calendar/microsoft/${tokenId}/calendars`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendars: calendars.map((cal) => ({
            id: cal.id,
            name: cal.name,
            enabled: cal.enabled,
            colour: cal.colour,
            sync_direction: cal.sync_direction,
          })),
        }),
      })
    } catch {}

    setSavingMsCalendars(false)
  }

  async function loadCalendarsForAccount(tokenId: string) {
    if (expandedAccount === tokenId) {
      setExpandedAccount(null)
      return
    }

    setLoadingCalendars(tokenId)
    setExpandedAccount(tokenId)

    try {
      const response = await apiFetch<{ calendars: GoogleCalendarItem[] }>(
        `/api/calendar/google/${tokenId}/calendars`
      )
      setCalendarLists((prev) => ({
        ...prev,
        [tokenId]: response.calendars,
      }))
    } catch {
      setCalendarLists((prev) => ({ ...prev, [tokenId]: [] }))
    } finally {
      setLoadingCalendars(null)
    }
  }

  function toggleCalendar(tokenId: string, calendarId: string) {
    setCalendarLists((prev) => ({
      ...prev,
      [tokenId]: (prev[tokenId] ?? []).map((cal) =>
        cal.id === calendarId ? { ...cal, enabled: !cal.enabled } : cal
      ),
    }))
  }

  function setSyncDirection(
    tokenId: string,
    calendarId: string,
    direction: 'push' | 'pull' | 'both'
  ) {
    setCalendarLists((prev) => ({
      ...prev,
      [tokenId]: (prev[tokenId] ?? []).map((cal) =>
        cal.id === calendarId ? { ...cal, sync_direction: direction } : cal
      ),
    }))
  }

  async function saveCalendarSelections(tokenId: string) {
    setSavingCalendars(true)
    const calendars = calendarLists[tokenId] ?? []

    try {
      await apiFetch(`/api/calendar/google/${tokenId}/calendars`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendars: calendars.map((cal) => ({
            id: cal.id,
            name: cal.summary,
            enabled: cal.enabled,
            colour: cal.backgroundColor,
            sync_direction: cal.sync_direction,
          })),
        }),
      })
    } catch {}

    setSavingCalendars(false)
  }

  async function handleAddFeed() {
    setFeedSaving(true)
    setFeedError(null)

    try {
      const response = await apiFetch<{ feed: CalendarFeed }>('/api/calendar/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedName,
          url: feedUrl,
          colour: feedColour,
        }),
      })

      setFeeds((prev) => [...prev, response.feed])
      setFeedName('')
      setFeedUrl('')
      setFeedColour(FEED_COLOURS[0].value)
      setShowAddFeed(false)
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : 'Failed to add feed'
      )
    } finally {
      setFeedSaving(false)
    }
  }

  async function handleDeleteFeed(feedId: string) {
    setDeleteFeedId(feedId)
  }

  async function confirmDeleteFeed() {
    if (!deleteFeedId) return
    setDeleteFeedLoading(true)

    try {
      await apiFetch(`/api/calendar/feeds/${deleteFeedId}`, { method: 'DELETE' })
      setFeeds((prev) => prev.filter((f) => f.id !== deleteFeedId))
      setDeleteFeedId(null)
    } catch {} finally {
      setDeleteFeedLoading(false)
    }
  }

  async function handleToggleFeed(feed: CalendarFeed) {
    try {
      const response = await apiFetch<{ feed: CalendarFeed }>(
        `/api/calendar/feeds/${feed.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !feed.enabled }),
        }
      )
      setFeeds((prev) =>
        prev.map((f) => (f.id === feed.id ? response.feed : f))
      )
    } catch {}
  }

  async function handleSyncFeed(feedId: string) {
    try {
      await apiFetch(`/api/calendar/feeds/${feedId}/sync`, { method: 'POST' })
      // Refresh feeds list
      const response = await apiFetch<{ feeds: CalendarFeed[] }>('/api/calendar/feeds')
      setFeeds(response.feeds)
    } catch {}
  }

  async function handleSyncAll() {
    setSyncState('syncing')
    setSyncResult(null)

    try {
      const response = await apiFetch<{
        pushed: number
        pulled: number
      }>('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both', days: 30 }),
      })

      setSyncResult(
        `Synced: ${response.pulled} events pulled, ${response.pushed} events pushed`
      )
      setSyncState('done')

      // Refresh feeds
      const feedResponse = await apiFetch<{ feeds: CalendarFeed[] }>('/api/calendar/feeds')
      setFeeds(feedResponse.feeds)

      setTimeout(() => setSyncState('idle'), 3000)
    } catch (error) {
      setSyncResult(
        error instanceof Error ? error.message : 'Sync failed'
      )
      setSyncState('idle')
    }
  }

  return (
    <div className="space-y-8">
      {googleAccounts.some((a) => a.needs_reconnect) && (
        <div className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] px-5 py-4">
          <p className="text-sm font-semibold text-[color:var(--red-strong)]">A Google account needs reconnecting</p>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            Google rejected the stored access for one or more accounts (token expired or revoked), so
            calendar and inbox sync are paused for them. Use the Reconnect button on the affected account below.
          </p>
        </div>
      )}

      {/* Sync all button */}
      <section className="os-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="os-section-title">
              Sync all calendars
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              Pull events from all connected Google, Microsoft, and iCal feed accounts
            </p>
          </div>
          <button
            type="button"
            disabled={syncState === 'syncing'}
            onClick={handleSyncAll}
            className="rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {syncState === 'syncing'
              ? 'Syncing…'
              : syncState === 'done'
                ? '✓ Synced'
                : 'Sync now'}
          </button>
        </div>
        {syncResult && (
          <p className="mt-3 text-sm text-[color:var(--text-2)]">{syncResult}</p>
        )}
      </section>

      {/* Google accounts */}
      <section className="os-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="os-eyebrow">
              Google Calendar
            </p>
            <h2 className="mt-2 os-section-title">
              Connected accounts
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              Two-way sync with Google Calendar. Add multiple accounts to
              consolidate personal and work calendars.
            </p>
          </div>
          <a
            href="/api/auth/google"
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            + Connect Google account
          </a>
        </div>

        {googleAccounts.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--text-3)]">
            No Google accounts connected. Click above to add one.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {googleAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  onClick={() => loadCalendarsForAccount(account.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-blue-600">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="flex items-center gap-2 font-medium text-[color:var(--text)]">
                        {account.email}
                        {account.needs_reconnect && (
                          <span className="rounded-full border border-[color:var(--red)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--red-strong)]">
                            Reconnect required
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[color:var(--text-3)]">
                        {account.label && account.label !== account.email
                          ? account.label
                          : 'Google Calendar'}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 text-[color:var(--text-2)] transition ${expandedAccount === account.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {account.needs_reconnect && (
                  <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] bg-[var(--red-dim)] px-5 py-3">
                    <span className="text-xs text-[color:var(--red-strong)]">
                      Google rejected this account&apos;s access — sync is paused until you reconnect.
                    </span>
                    <a
                      href="/api/auth/google"
                      className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)]"
                    >
                      Reconnect
                    </a>
                  </div>
                )}

                {expandedAccount === account.id && (
                  <div className="border-t border-[color:var(--border)] px-5 py-4">
                    {loadingCalendars === account.id ? (
                      <p className="text-sm text-[color:var(--text-3)]">
                        Loading calendars…
                      </p>
                    ) : (calendarLists[account.id] ?? []).length === 0 ? (
                      <p className="text-sm text-[color:var(--text-3)]">
                        No calendars found for this account.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {(calendarLists[account.id] ?? []).map((cal) => (
                            <div
                              key={cal.id}
                              className="flex items-center justify-between gap-4"
                            >
                              <label className="flex items-center gap-3 text-sm">
                                <input
                                  type="checkbox"
                                  checked={cal.enabled}
                                  onChange={() =>
                                    toggleCalendar(account.id, cal.id)
                                  }
                                  className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)] text-blue-500 focus:ring-blue-500"
                                />
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      cal.backgroundColor ?? '#3B82F6',
                                  }}
                                />
                                <span className="text-[color:var(--text-2)]">
                                  {cal.summary}
                                  {cal.primary && (
                                    <span className="ml-2 text-xs text-[color:var(--text-3)]">
                                      (primary)
                                    </span>
                                  )}
                                </span>
                              </label>

                              {cal.enabled && (
                                <select
                                  value={cal.sync_direction}
                                  onChange={(e) =>
                                    setSyncDirection(
                                      account.id,
                                      cal.id,
                                      e.target.value as
                                        | 'push'
                                        | 'pull'
                                        | 'both'
                                    )
                                  }
                                  className="rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[color:var(--text-2)]"
                                >
                                  <option value="pull">Pull only</option>
                                  <option value="push">Push only</option>
                                  <option value="both">Two-way</option>
                                </select>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={savingCalendars}
                            onClick={() =>
                              saveCalendarSelections(account.id)
                            }
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                          >
                            {savingCalendars ? 'Saving…' : 'Save selections'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Microsoft accounts */}
      <section className="os-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="os-eyebrow">
              Microsoft Calendar
            </p>
            <h2 className="mt-2 os-section-title">
              Connected accounts
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              Two-way sync with Microsoft 365 / Outlook.com calendars.
            </p>
          </div>
          <a
            href="/api/auth/microsoft"
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            + Connect Microsoft account
          </a>
        </div>

        {microsoftAccounts.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--text-3)]">
            No Microsoft accounts connected. Click above to add one.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {microsoftAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  onClick={() => loadCalendarsForMsAccount(account.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sky-600">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-[color:var(--text)]">
                        {account.email}
                      </p>
                      <p className="text-xs text-[color:var(--text-3)]">
                        {account.label && account.label !== account.email
                          ? account.label
                          : 'Microsoft Calendar'}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 text-[color:var(--text-2)] transition ${expandedMsAccount === account.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {expandedMsAccount === account.id && (
                  <div className="border-t border-[color:var(--border)] px-5 py-4">
                    {loadingMsCalendars === account.id ? (
                      <p className="text-sm text-[color:var(--text-3)]">
                        Loading calendars…
                      </p>
                    ) : (msCalendarLists[account.id] ?? []).length === 0 ? (
                      <p className="text-sm text-[color:var(--text-3)]">
                        No calendars found for this account.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {(msCalendarLists[account.id] ?? []).map((cal) => (
                            <div
                              key={cal.id}
                              className="flex items-center justify-between gap-4"
                            >
                              <label className="flex items-center gap-3 text-sm">
                                <input
                                  type="checkbox"
                                  checked={cal.enabled}
                                  onChange={() =>
                                    toggleMsCalendar(account.id, cal.id)
                                  }
                                  className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)] text-sky-500 focus:ring-sky-500"
                                />
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{
                                    backgroundColor: cal.colour ?? '#3B82F6',
                                  }}
                                />
                                <span className="text-[color:var(--text-2)]">
                                  {cal.name}
                                  {cal.isDefaultCalendar && (
                                    <span className="ml-2 text-xs text-[color:var(--text-3)]">
                                      (default)
                                    </span>
                                  )}
                                </span>
                              </label>

                              {cal.enabled && cal.canEdit && (
                                <select
                                  value={cal.sync_direction}
                                  onChange={(e) =>
                                    setMsSyncDirection(
                                      account.id,
                                      cal.id,
                                      e.target.value as
                                        | 'push'
                                        | 'pull'
                                        | 'both'
                                    )
                                  }
                                  className="rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[color:var(--text-2)]"
                                >
                                  <option value="pull">Pull only</option>
                                  <option value="push">Push only</option>
                                  <option value="both">Two-way</option>
                                </select>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={savingMsCalendars}
                            onClick={() =>
                              saveMsCalendarSelections(account.id)
                            }
                            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
                          >
                            {savingMsCalendars ? 'Saving…' : 'Save selections'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* iCal feed subscriptions */}
      <section className="os-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="os-eyebrow">
              External Calendars
            </p>
            <h2 className="mt-2 os-section-title">
              iCal feed subscriptions
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              Subscribe to iCal (.ics) feeds from Apple Calendar, Outlook, or
              any calendar app. Events are pulled in read-only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFeed(true)}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            + Add feed
          </button>
        </div>

        {/* Add feed form */}
        {showAddFeed && (
          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div>
              <label className="os-eyebrow">
                Feed name
              </label>
              <input
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder="e.g. iCloud Personal, Outlook Work"
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)]"
              />
            </div>
            <div>
              <label className="os-eyebrow">
                iCal URL
              </label>
              <input
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://... or webcal://..."
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)]"
              />
            </div>
            <div>
              <label className="os-eyebrow">
                Colour
              </label>
              <div className="mt-2 flex gap-2">
                {FEED_COLOURS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFeedColour(c.value)}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      feedColour === c.value
                        ? 'border-[color:var(--text)] scale-110'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {feedError && (
              <p className="text-sm text-[color:var(--red-strong)]">{feedError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={feedSaving || !feedName.trim() || !feedUrl.trim()}
                onClick={handleAddFeed}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {feedSaving ? 'Adding…' : 'Add & sync'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddFeed(false)
                  setFeedError(null)
                }}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
              >
                Cancel
              </button>
            </div>

            {/* How-to guide */}
            <details className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text-2)]">
              <summary className="cursor-pointer font-medium text-[color:var(--text)]">
                How to find your iCal URL
              </summary>
              <div className="mt-4 space-y-4 text-[color:var(--text-2)]">
                <div>
                  <p className="font-medium text-[color:var(--text)]">
                    Apple / iCloud Calendar
                  </p>
                  <p>
                    1. Open Calendar on Mac → right-click a calendar →
                    &quot;Share Calendar…&quot;
                  </p>
                  <p>2. Tick &quot;Public Calendar&quot;</p>
                  <p>3. Copy the webcal:// URL and paste it above</p>
                </div>
                <div>
                  <p className="font-medium text-[color:var(--text)]">
                    Outlook / Microsoft 365
                  </p>
                  <p>1. Go to outlook.live.com → Calendar → Settings (⚙️)</p>
                  <p>
                    2. Shared calendars → Publish a calendar → select your
                    calendar
                  </p>
                  <p>3. Copy the ICS link and paste it above</p>
                </div>
                <div>
                  <p className="font-medium text-[color:var(--text)]">
                    Google Calendar (as a feed)
                  </p>
                  <p>
                    1. calendar.google.com → Settings → select your calendar
                  </p>
                  <p>2. Scroll to &quot;Secret address in iCal format&quot;</p>
                  <p>3. Copy the URL and paste it above</p>
                  <p className="text-xs text-[color:var(--text-3)] mt-1">
                    Tip: For Google, the two-way sync via OAuth is better — use
                    iCal feeds only for calendars you share with others.
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Existing feeds */}
        {feeds.length === 0 && !showAddFeed ? (
          <p className="mt-6 text-sm text-[color:var(--text-3)]">
            No iCal feeds configured. Add one to import events from Apple
            Calendar, Outlook, or other apps.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: feed.colour }}
                  />
                  <div>
                    <p className="font-medium text-[color:var(--text)]">{feed.name}</p>
                    <p className="text-xs text-[color:var(--text-3)]">
                      {feed.event_count} events
                      {feed.last_fetched_at
                        ? ` · Last synced ${new Date(feed.last_fetched_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ' · Not synced yet'}
                      {feed.last_error && (
                        <span className="ml-2 text-[color:var(--red-strong)]">
                          Error: {feed.last_error}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSyncFeed(feed.id)}
                    className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
                    title="Sync now"
                  >
                    ↻ Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFeed(feed)}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                      feed.enabled
                        ? 'border-[color:var(--green)] text-[color:var(--green-strong)]'
                        : 'border-[color:var(--border)] text-[color:var(--text-3)]'
                    }`}
                  >
                    {feed.enabled ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFeed(feed.id)}
                    className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--red-strong)] transition hover:border-[color:var(--red)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteFeedId !== null}
        onOpenChange={(open) => { if (!open) setDeleteFeedId(null) }}
        title="Remove calendar feed?"
        description="This feed and all its events will be permanently removed."
        confirmLabel="Remove feed"
        onConfirm={() => void confirmDeleteFeed()}
        loading={deleteFeedLoading}
        variant="destructive"
      />
    </div>
  )
}
