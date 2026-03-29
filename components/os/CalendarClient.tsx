'use client'

import Link from 'next/link'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatDateTime, formatTaskDate } from '@/lib/os'
import type { CalendarEvent, Contact, TaskWithWorkstream, Workstream } from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import WorkstreamBadge from './WorkstreamBadge'

const EVENT_COLOURS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Coral', value: '#D85A30' },
] as const

const TASK_COLOURS_BY_SLUG: Record<string, string> = {
  'brand-sales': '#1D9E75',
  ecommerce: '#BA7517',
  'app-dev': '#534AB7',
  'mvp-cricket': '#639922',
  consulting: '#D85A30',
}

type CalendarFeedResponse = {
  events: CalendarEvent[]
  tasks: TaskWithWorkstream[]
}

type SelectedCalendarItem =
  | { type: 'task'; data: TaskWithWorkstream }
  | { type: 'event'; data: CalendarEvent }
  | null

interface EventFormState {
  title: string
  description: string
  all_day: boolean
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  location: string
  workstream_id: string
  contact_id: string
  colour: string
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function formatLocalTime(value: Date) {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function parseLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}`)
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function addHours(value: Date, hours: number) {
  const next = new Date(value)
  next.setHours(next.getHours() + hours)
  return next
}

function formatDateRange(startAt: string, endAt: string, allDay: boolean) {
  const start = new Date(startAt)
  const end = new Date(endAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return allDay ? `${startAt} - ${endAt}` : `${startAt} - ${endAt}`
  }

  if (allDay) {
    const inclusiveEnd = new Date(end.getTime() - 1)
    const sameDay = formatLocalDate(start) === formatLocalDate(inclusiveEnd)

    if (sameDay) {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(start)
    }

    return `${new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(start)} - ${new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(inclusiveEnd)}`
  }

  return `${formatDateTime(startAt)} - ${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(end)}`
}

function createDefaultFormState() {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return {
    title: '',
    description: '',
    all_day: false,
    start_date: formatLocalDate(start),
    start_time: formatLocalTime(start),
    end_date: formatLocalDate(end),
    end_time: formatLocalTime(end),
    location: '',
    workstream_id: '',
    contact_id: '',
    colour: EVENT_COLOURS[0].value,
  }
}

function createFormStateFromSelection(selection: { start: Date; end: Date; allDay: boolean }): EventFormState {
  const { start, end, allDay } = selection

  if (allDay) {
    const inclusiveEnd = new Date(end.getTime() - 1)
    return {
      title: '',
      description: '',
      all_day: true,
      start_date: formatLocalDate(start),
      start_time: '09:00',
      end_date: formatLocalDate(inclusiveEnd),
      end_time: '17:00',
      location: '',
      workstream_id: '',
      contact_id: '',
      colour: EVENT_COLOURS[0].value,
    }
  }

  return {
    title: '',
    description: '',
    all_day: false,
    start_date: formatLocalDate(start),
    start_time: formatLocalTime(start),
    end_date: formatLocalDate(end),
    end_time: formatLocalTime(end),
    location: '',
    workstream_id: '',
    contact_id: '',
    colour: EVENT_COLOURS[0].value,
  }
}

function createFormStateFromEvent(event: CalendarEvent): EventFormState {
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const displayEnd = event.all_day ? new Date(end.getTime() - 1) : end

  return {
    title: event.title,
    description: event.description ?? '',
    all_day: event.all_day,
    start_date: formatLocalDate(start),
    start_time: formatLocalTime(start),
    end_date: formatLocalDate(displayEnd),
    end_time: formatLocalTime(displayEnd),
    location: event.location ?? '',
    workstream_id: event.workstream_id ?? '',
    contact_id: event.contact_id ?? '',
    colour: event.colour ?? EVENT_COLOURS[0].value,
  }
}

function buildPayloadFromForm(form: EventFormState) {
  if (!form.title.trim()) {
    throw new Error('Title is required')
  }

  if (!form.start_date || !form.end_date) {
    throw new Error('Start and end dates are required')
  }

  if (form.all_day) {
    const start = parseLocalDateTime(form.start_date, '00:00')
    const end = addDays(parseLocalDateTime(form.end_date, '00:00'), 1)

    if (end.getTime() < start.getTime()) {
      throw new Error('End date must be on or after the start date')
    }

    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      all_day: true,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      location: form.location.trim() || null,
      workstream_id: form.workstream_id || null,
      contact_id: form.contact_id || null,
      colour: form.colour,
    }
  }

  if (!form.start_time || !form.end_time) {
    throw new Error('Start and end times are required')
  }

  const start = parseLocalDateTime(form.start_date, form.start_time)
  const end = parseLocalDateTime(form.end_date, form.end_time)

  if (end.getTime() < start.getTime()) {
    throw new Error('End time must be on or after the start time')
  }

  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    all_day: false,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    location: form.location.trim() || null,
    workstream_id: form.workstream_id || null,
    contact_id: form.contact_id || null,
    colour: form.colour,
  }
}

function getTaskColour(task: TaskWithWorkstream, workstreams: Workstream[]) {
  const workstream = workstreams.find((entry) => entry.id === task.workstream_id)
  if (!workstream) {
    return '#888780'
  }

  return TASK_COLOURS_BY_SLUG[workstream.slug] ?? '#888780'
}

function getWorkstreamById(workstreams: Workstream[], id?: string | null) {
  if (!id) {
    return null
  }

  return workstreams.find((entry) => entry.id === id) ?? null
}

function getContactById(contacts: Contact[], id?: string | null) {
  if (!id) {
    return null
  }

  return contacts.find((entry) => entry.id === id) ?? null
}

function toEventInput(
  events: CalendarEvent[],
  tasks: TaskWithWorkstream[],
  workstreams: Workstream[]
): EventInput[] {
  const taskInputs = tasks
    .filter((task) => task.due_date)
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.due_date!,
      allDay: true,
      backgroundColor: getTaskColour(task, workstreams),
      borderColor: getTaskColour(task, workstreams),
      durationEditable: false,
      extendedProps: {
        type: 'task',
        data: task,
      },
    }))

  const eventInputs = events.map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    start: event.all_day ? formatLocalDate(new Date(event.start_at)) : event.start_at,
    end: event.all_day ? formatLocalDate(new Date(event.end_at)) : event.end_at,
    allDay: event.all_day,
    backgroundColor: event.colour || '#3B82F6',
    borderColor: event.colour || '#3B82F6',
    extendedProps: {
      type: 'event',
      data: event,
    },
  }))

  return [...taskInputs, ...eventInputs]
}

function buildEventPatchFromCalendarApi(event: {
  start: Date | null
  end: Date | null
  allDay: boolean
}) {
  if (!event.start) {
    throw new Error('Event start time is missing')
  }

  if (event.allDay) {
    return {
      start_at: event.start.toISOString(),
      end_at: (event.end ?? addDays(event.start, 1)).toISOString(),
      all_day: true,
    }
  }

  return {
    start_at: event.start.toISOString(),
    end_at: (event.end ?? event.start).toISOString(),
    all_day: false,
  }
}

export default function CalendarClient({
  workstreams,
  contacts,
  googleConnected,
}: {
  workstreams: Workstream[]
  contacts: Contact[]
  googleConnected: boolean
}) {
  const calendarRef = useRef<FullCalendar | null>(null)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<TaskWithWorkstream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedCalendarItem>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(createDefaultFormState())
  const [formError, setFormError] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const fullCalendarEvents = toEventInput(events, tasks, workstreams)
  const selectedEvent = selectedItem?.type === 'event' ? selectedItem.data : null
  const selectedTask = selectedItem?.type === 'task' ? selectedItem.data : null

  const filteredContacts = contacts.filter((contact) => {
    const query = contactSearch.trim().toLowerCase()
    if (!query) {
      return true
    }

    return [contact.name, contact.company ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  useEffect(() => {
    try {
      setLastSyncedAt(window.localStorage.getItem('calendar:last-google-sync'))
    } catch {}
  }, [])

  async function loadCalendarRange(start: string, end: string) {
    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch<CalendarFeedResponse>(
        `/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      )
      setEvents(response.events)
      setTasks(response.tasks)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  function closeForm() {
    setFormOpen(false)
    setEditingEventId(null)
    setFormError(null)
    setForm(createDefaultFormState())
    setContactSearch('')
    calendarRef.current?.getApi().unselect()
  }

  function openCreateForm(selection: { start: Date; end: Date; allDay: boolean }) {
    setSelectedItem(null)
    setEditingEventId(null)
    setForm(createFormStateFromSelection(selection))
    setContactSearch('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(event: CalendarEvent) {
    const contact = getContactById(contacts, event.contact_id)
    setEditingEventId(event.id)
    setForm(createFormStateFromEvent(event))
    setContactSearch(contact?.name ?? '')
    setFormError(null)
    setFormOpen(true)
  }

  async function handleDatesSet(arg: DatesSetArg) {
    await loadCalendarRange(arg.start.toISOString(), arg.end.toISOString())
  }

  function handleDateClick(arg: DateClickArg) {
    const start = arg.date
    const end = arg.allDay ? addDays(start, 1) : addHours(start, 1)
    openCreateForm({ start, end, allDay: arg.allDay })
  }

  function handleSelect(arg: DateSelectArg) {
    openCreateForm({
      start: arg.start,
      end: arg.end,
      allDay: arg.allDay,
    })
  }

  function handleEventClick(arg: EventClickArg) {
    const itemType = arg.event.extendedProps.type as 'task' | 'event'

    if (itemType === 'task') {
      setSelectedItem({
        type: 'task',
        data: arg.event.extendedProps.data as TaskWithWorkstream,
      })
      return
    }

    setSelectedItem({
      type: 'event',
      data: arg.event.extendedProps.data as CalendarEvent,
    })
  }

  async function handleReschedule(arg: EventDropArg | EventResizeDoneArg) {
    const itemType = arg.event.extendedProps.type as 'task' | 'event'

    try {
      if (itemType === 'task') {
        const task = arg.event.extendedProps.data as TaskWithWorkstream
        if (!arg.event.start) {
          throw new Error('Task date is missing')
        }

        const dueDate = formatLocalDate(arg.event.start)
        const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ due_date: dueDate }),
        })

        setTasks((current) =>
          current.map((entry) => (entry.id === task.id ? response.task : entry))
        )

        if (selectedItem?.type === 'task' && selectedItem.data.id === task.id) {
          setSelectedItem({ type: 'task', data: response.task })
        }

        return
      }

      const event = arg.event.extendedProps.data as CalendarEvent
      const payload = buildEventPatchFromCalendarApi(arg.event)
      const response = await apiFetch<{ event: CalendarEvent }>(`/api/calendar/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setEvents((current) =>
        current.map((entry) => (entry.id === event.id ? response.event : entry))
      )

      if (selectedItem?.type === 'event' && selectedItem.data.id === event.id) {
        setSelectedItem({ type: 'event', data: response.event })
      }
    } catch (saveError) {
      arg.revert()
      setError(saveError instanceof Error ? saveError.message : 'Failed to reschedule item')
    }
  }

  async function handleSaveEvent() {
    setFormSaving(true)
    setFormError(null)

    try {
      const payload = buildPayloadFromForm(form)

      if (editingEventId) {
        const response = await apiFetch<{ event: CalendarEvent }>(`/api/calendar/${editingEventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        setEvents((current) =>
          current.map((entry) => (entry.id === editingEventId ? response.event : entry))
        )
        setSelectedItem({ type: 'event', data: response.event })
      } else {
        const response = await apiFetch<{ event: CalendarEvent }>('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        setEvents((current) =>
          [...current, response.event].sort(
            (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
          )
        )
        setSelectedItem({ type: 'event', data: response.event })
      }

      closeForm()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to save event')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDeleteEvent(event: CalendarEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) {
      return
    }

    try {
      await apiFetch(`/api/calendar/${event.id}`, { method: 'DELETE' })
      setEvents((current) => current.filter((entry) => entry.id !== event.id))
      setSelectedItem(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete event')
    }
  }

  async function handleGoogleSync() {
    setSyncState('syncing')
    setError(null)

    try {
      await apiFetch<{ pushed: number; pulled: number }>('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both', days: 30 }),
      })

      const calendarApi = calendarRef.current?.getApi()
      if (calendarApi) {
        await loadCalendarRange(
          calendarApi.view.activeStart.toISOString(),
          calendarApi.view.activeEnd.toISOString()
        )
      }

      const syncedAt = new Date().toISOString()
      setLastSyncedAt(syncedAt)
      try {
        window.localStorage.setItem('calendar:last-google-sync', syncedAt)
      } catch {}

      setSyncState('synced')
      window.setTimeout(() => setSyncState('idle'), 2000)
    } catch (syncError) {
      setSyncState('idle')
      setError(syncError instanceof Error ? syncError.message : 'Failed to sync with Google')
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Planning</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Tasks with due dates and standalone events, together in one calendar.
            </p>
            {googleConnected && lastSyncedAt ? (
              <p className="mt-3 text-xs text-slate-500">
                Last synced {new Date(lastSyncedAt).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {googleConnected ? (
              <button
                type="button"
                onClick={() => void handleGoogleSync()}
                disabled={syncState === 'syncing'}
                className="rounded-2xl border border-sky-500/30 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:border-sky-400 hover:bg-slate-900 disabled:opacity-60"
              >
                {syncState === 'syncing'
                  ? 'Syncing...'
                  : syncState === 'synced'
                    ? 'Synced'
                    : 'Sync with Google'}
              </button>
            ) : (
              <Link
                href="/settings"
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Connect Google Calendar
              </Link>
            )}
            <button
              type="button"
              onClick={() =>
                openCreateForm({
                  start: new Date(),
                  end: addHours(new Date(), 1),
                  allDay: false,
                })
              }
              className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
            >
              New event
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4 md:p-6">
          {loading ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-700 px-4 py-16 text-center text-sm text-slate-400">
              Loading calendar...
            </div>
          ) : null}

          <div className={loading ? 'hidden' : 'block'}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              height="auto"
              editable
              selectable
              events={fullCalendarEvents}
              datesSet={handleDatesSet}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              select={handleSelect}
              eventDrop={handleReschedule}
              eventResize={handleReschedule}
            />
          </div>
        </section>
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65">
          <button
            type="button"
            aria-label="Close detail panel"
            className="flex-1"
            onClick={() => setSelectedItem(null)}
          />
          <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  {selectedTask ? 'Task detail' : 'Calendar event'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  {selectedTask?.title ?? selectedEvent?.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300"
              >
                Close
              </button>
            </div>

            {selectedTask ? (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={selectedTask.priority} />
                  {selectedTask.workstream_label ? (
                    <WorkstreamBadge
                      label={selectedTask.workstream_label}
                      slug={selectedTask.workstream_slug}
                      colour={selectedTask.workstream_colour}
                    />
                  ) : null}
                </div>

                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Due date</dt>
                    <dd className="mt-1 text-slate-200">{formatTaskDate(selectedTask.due_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-200">
                      {selectedTask.description || 'No description yet.'}
                    </dd>
                  </div>
                </dl>

                {selectedTask.workstream_slug ? (
                  <Link
                    href={`/projects/${selectedTask.workstream_slug}`}
                    className="inline-flex items-center rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500"
                  >
                    View on board →
                  </Link>
                ) : null}
              </div>
            ) : selectedEvent ? (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const workstream = getWorkstreamById(workstreams, selectedEvent.workstream_id)
                    return workstream ? (
                      <WorkstreamBadge
                        label={workstream.label}
                        slug={workstream.slug}
                        colour={workstream.colour}
                      />
                    ) : null
                  })()}
                  {selectedEvent.colour ? (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: selectedEvent.colour }}
                      />
                      {selectedEvent.colour}
                    </span>
                  ) : null}
                </div>

                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Date & time</dt>
                    <dd className="mt-1 text-slate-200">
                      {formatDateRange(selectedEvent.start_at, selectedEvent.end_at, selectedEvent.all_day)}
                    </dd>
                  </div>
                  {selectedEvent.location ? (
                    <div>
                      <dt className="text-slate-500">Location</dt>
                      <dd className="mt-1 text-slate-200">{selectedEvent.location}</dd>
                    </div>
                  ) : null}
                  {selectedEvent.contact_id ? (
                    <div>
                      <dt className="text-slate-500">Contact</dt>
                      <dd className="mt-1 text-slate-200">
                        {getContactById(contacts, selectedEvent.contact_id)?.name ?? 'Unknown contact'}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-slate-500">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-200">
                      {selectedEvent.description || 'No description yet.'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openEditForm(selectedEvent)}
                    className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(selectedEvent)}
                    className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close event form"
            onClick={closeForm}
          />
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  {editingEventId ? 'Edit event' : 'New event'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  {editingEventId ? 'Update calendar event' : 'Create calendar event'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-5">
              {formError ? (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {formError}
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Title</span>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, all_day: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                <span className="text-sm text-slate-200">All day</span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Start date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, start_date: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>
                {!form.all_day ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">Start time</span>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, start_time: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">End date</span>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, end_date: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>
                {!form.all_day ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">End time</span>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, end_time: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Location</span>
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, location: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Workstream</span>
                  <select
                    value={form.workstream_id}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, workstream_id: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  >
                    <option value="">No workstream</option>
                    {workstreams.map((workstream) => (
                      <option key={workstream.id} value={workstream.id}>
                        {workstream.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-300">Contact</span>
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search contacts"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                />
                <select
                  value={form.contact_id}
                  onChange={(event) => {
                    const nextContactId = event.target.value
                    const nextContact = contacts.find((contact) => contact.id === nextContactId)
                    setForm((current) => ({ ...current, contact_id: nextContactId }))
                    setContactSearch(nextContact?.name ?? '')
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">No contact selected</option>
                  {filteredContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company ? `${contact.name} — ${contact.company}` : contact.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-300">Colour</span>
                <div className="flex flex-wrap gap-3">
                  {EVENT_COLOURS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, colour: colour.value }))}
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${
                        form.colour === colour.value
                          ? 'border-slate-200 text-slate-100'
                          : 'border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: colour.value }}
                        />
                        {colour.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={5}
                  className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={handleSaveEvent}
                className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-60"
              >
                {formSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
