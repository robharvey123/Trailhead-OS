'use client'

import Link from 'next/link'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { getWorkstreamAccentHex } from '@/lib/os'
import { formatDateTime, formatTaskSchedule } from '@/lib/os'
import type {
  CalendarEvent,
  Contact,
  ProjectListItem,
  TaskWithWorkstream,
  Workstream,
} from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import ConfirmDialog from './ConfirmDialog'
import WorkstreamBadge from './WorkstreamBadge'

const EVENT_COLOURS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Coral', value: '#D85A30' },
] as const

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
  project_id: string
  colour: string
  add_meet: boolean
  attendees: string
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
    project_id: '',
    colour: EVENT_COLOURS[0].value,
    add_meet: false,
    attendees: '',
  }
}

function createFormStateFromSelection(selection: {
  start: Date
  end: Date
  allDay: boolean
}): EventFormState {
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
      project_id: '',
      colour: EVENT_COLOURS[0].value,
      add_meet: false,
      attendees: '',
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
    project_id: '',
    colour: EVENT_COLOURS[0].value,
    add_meet: false,
    attendees: '',
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
    project_id: event.project_id ?? '',
    colour: event.colour ?? EVENT_COLOURS[0].value,
    add_meet: false,
    attendees: '',
  }
}

function parseAttendees(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
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
      project_id: form.project_id || null,
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
    project_id: form.project_id || null,
    colour: form.colour,
  }
}

function getTaskColour(task: TaskWithWorkstream, workstreams: Workstream[]) {
  const workstream = workstreams.find(
    (entry) => entry.id === task.workstream_id
  )
  if (!workstream) {
    return getWorkstreamAccentHex()
  }

  return getWorkstreamAccentHex(workstream.colour || workstream.slug)
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
    .map((task) => {
      const hasTime = Boolean(task.due_time)

      return {
        id: `task-${task.id}`,
        title: task.title,
        date: hasTime ? undefined : task.due_date!,
        start: hasTime ? `${task.due_date}T${task.due_time}` : undefined,
        allDay: !hasTime,
        backgroundColor: getTaskColour(task, workstreams),
        borderColor: getTaskColour(task, workstreams),
        durationEditable: false,
        extendedProps: {
          type: 'task',
          data: task,
        },
      }
    })

  const eventInputs = events.map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    start: event.all_day
      ? formatLocalDate(new Date(event.start_at))
      : event.start_at,
    end: event.all_day ? formatLocalDate(new Date(event.end_at)) : event.end_at,
    allDay: event.all_day,
    backgroundColor: event.colour || '#3B82F6',
    borderColor: event.colour || '#3B82F6',
    editable: !event.read_only,
    extendedProps: {
      type: 'event',
      data: event,
      source: event.source,
      meet: Boolean(event.meet_link),
    },
  }))

  return [...taskInputs, ...eventInputs]
}

/** Left-icon + ellipsised title for event chips: ✅ task, 🎥 Meet, 📅 default. */
function renderEventContent(arg: { event: { title: string; extendedProps: Record<string, unknown> } }) {
  const props = arg.event.extendedProps
  const icon = props.type === 'task' ? '✅' : props.meet ? '🎥' : '📅'
  return (
    <span className="cal-chip" title={arg.event.title}>
      <span className="cal-chip-icon">{icon}</span>
      <span className="cal-chip-title">{arg.event.title}</span>
    </span>
  )
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
  projects,
  googleConnected,
  feeds = [],
}: {
  workstreams: Workstream[]
  contacts: Contact[]
  projects: ProjectListItem[]
  googleConnected: boolean
  feeds?: Array<{ id: string; name: string; colour: string | null }>
}) {
  const calendarRef = useRef<FullCalendar | null>(null)

  // Open the time grid scrolled to ~now, so the current time is on screen (the
  // nowIndicator red line sits just below the top).
  const initialScrollTime = useMemo(() => {
    const now = new Date()
    return `${String(Math.max(0, now.getHours() - 1)).padStart(2, '0')}:00:00`
  }, [])

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<TaskWithWorkstream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedCalendarItem>(null)
  const [deleteEventTarget, setDeleteEventTarget] = useState<CalendarEvent | null>(null)
  const [deleteEventLoading, setDeleteEventLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(createDefaultFormState())
  const [formError, setFormError] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [meetToast, setMeetToast] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  // Which "calendars" are visible. Empty set = all shown. Keys: 'tasks',
  // 'events' (app/Google/Microsoft), and `feed:<id>` per subscribed feed.
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set())
  const [calMenuOpen, setCalMenuOpen] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>(
    'idle'
  )
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const calendarOptions = [
    { key: 'tasks', label: 'Tasks', colour: 'var(--accent)' },
    { key: 'events', label: 'My events', colour: '#3B82F6' },
    ...feeds.map((feed) => ({ key: `feed:${feed.id}`, label: feed.name, colour: feed.colour || 'var(--text-3)' })),
  ]
  const calendarKeyForEvent = (event: CalendarEvent) =>
    event.source === 'feed' && event.feed_id ? `feed:${event.feed_id}` : 'events'

  function toggleCalendar(key: string) {
    setHiddenCalendars((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const projectScopedEvents = projectFilter
    ? events.filter((event) => event.project_id === projectFilter)
    : events
  const filteredEvents = projectScopedEvents.filter((event) => !hiddenCalendars.has(calendarKeyForEvent(event)))
  const projectScopedTasks = projectFilter
    ? tasks.filter((task) => task.project_id === projectFilter)
    : tasks
  const filteredTasksForCalendar = hiddenCalendars.has('tasks') ? [] : projectScopedTasks
  const fullCalendarEvents = toEventInput(filteredEvents, filteredTasksForCalendar, workstreams)
  const selectedEvent =
    selectedItem?.type === 'event' ? selectedItem.data : null
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
  const filteredProjects = projects.filter(
    (project) => !form.workstream_id || project.workstream_id === form.workstream_id
  )

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
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load calendar'
      )
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

  function openCreateForm(selection: {
    start: Date
    end: Date
    allDay: boolean
  }) {
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
        const response = await apiFetch<{ task: TaskWithWorkstream }>(
          `/api/tasks/${task.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              due_date: dueDate,
              due_time: arg.event.allDay ? null : formatLocalTime(arg.event.start),
            }),
          }
        )

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
      const response = await apiFetch<{ event: CalendarEvent }>(
        `/api/calendar/${event.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      setEvents((current) =>
        current.map((entry) => (entry.id === event.id ? response.event : entry))
      )

      if (selectedItem?.type === 'event' && selectedItem.data.id === event.id) {
        setSelectedItem({ type: 'event', data: response.event })
      }
    } catch (saveError) {
      arg.revert()
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to reschedule item'
      )
    }
  }

  async function handleSaveEvent() {
    setFormSaving(true)
    setFormError(null)

    try {
      const payload = buildPayloadFromForm(form)

      if (editingEventId) {
        const response = await apiFetch<{ event: CalendarEvent }>(
          `/api/calendar/${editingEventId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )

        setEvents((current) =>
          current.map((entry) =>
            entry.id === editingEventId ? response.event : entry
          )
        )
        setSelectedItem({ type: 'event', data: response.event })
      } else {
        const response = await apiFetch<{ event: CalendarEvent; meetLink: string | null }>(
          '/api/calendar',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              add_meet: form.add_meet,
              attendees: parseAttendees(form.attendees),
            }),
          }
        )

        setEvents((current) =>
          [...current, response.event].sort(
            (left, right) =>
              new Date(left.start_at).getTime() -
              new Date(right.start_at).getTime()
          )
        )
        setSelectedItem({ type: 'event', data: response.event })
        if (response.meetLink) setMeetToast(response.meetLink)
      }

      closeForm()
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : 'Failed to save event'
      )
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDeleteEvent(event: CalendarEvent) {
    setDeleteEventTarget(event)
  }

  async function confirmDeleteEvent() {
    if (!deleteEventTarget) return
    setDeleteEventLoading(true)

    try {
      await apiFetch(`/api/calendar/${deleteEventTarget.id}`, { method: 'DELETE' })
      setEvents((current) => current.filter((entry) => entry.id !== deleteEventTarget.id))
      setSelectedItem(null)
      setDeleteEventTarget(null)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete event'
      )
    } finally {
      setDeleteEventLoading(false)
    }
  }

  async function handleGoogleSync() {
    setSyncState('syncing')
    setError(null)

    try {
      const result = await apiFetch<{ pushed: number; pulled: number }>('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'both', days: 60 }),
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
      if (result.pulled === 0 && result.pushed === 0) {
        setError('Sync completed but no events were found. Check your calendar selections in Integrations.')
      }
      window.setTimeout(() => setSyncState('idle'), 3000)
    } catch (syncError) {
      setSyncState('idle')
      setError(
        syncError instanceof Error
          ? syncError.message
          : 'Failed to sync with Google'
      )
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="os-eyebrow">
              Planning
            </p>
            <h1 className="os-page-title mt-2">
              Calendar
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
              Tasks with due dates and standalone events, together in one
              calendar.
            </p>
            {googleConnected && lastSyncedAt ? (
              <p className="mt-3 text-xs text-[color:var(--text-3)]">
                Last synced {new Date(lastSyncedAt).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCalMenuOpen((open) => !open)}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:bg-[var(--surface-2)]"
              >
                Calendars{hiddenCalendars.size ? ` (${calendarOptions.length - hiddenCalendars.size}/${calendarOptions.length})` : ''}
              </button>
              {calMenuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close calendars menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setCalMenuOpen(false)}
                  />
                  <div className="absolute left-0 z-50 mt-2 w-60 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                    {calendarOptions.map((option) => {
                      const visible = !hiddenCalendars.has(option.key)
                      return (
                        <label
                          key={option.key}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-[color:var(--text)] hover:bg-[var(--surface-2)]"
                        >
                          <input type="checkbox" checked={visible} onChange={() => toggleCalendar(option.key)} />
                          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: option.colour }} />
                          <span className="truncate">{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="os-select px-4 py-2.5 text-sm font-medium"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleGoogleSync()}
              disabled={syncState === 'syncing'}
              className="rounded-2xl border border-[color:var(--accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--accent-strong)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {syncState === 'syncing'
                ? 'Syncing...'
                : syncState === 'synced'
                  ? 'Synced'
                  : 'Sync all'}
            </button>
            <Link
              href="/calendar/integrations"
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:bg-[var(--surface-2)]"
            >
              Integrations
            </Link>
            <button
              type="button"
              onClick={() =>
                openCreateForm({
                  start: new Date(),
                  end: addHours(new Date(), 1),
                  allDay: false,
                })
              }
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:bg-[var(--surface-2)]"
            >
              New event
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-[color:var(--red)] bg-[var(--red-dim)] px-4 py-3 text-sm text-[color:var(--red-strong)]">
            {error}
          </div>
        ) : null}

        <section className="os-card p-4 md:p-6">
          {loading ? (
            <div className="rounded-[1.75rem] border border-dashed border-[color:var(--border)] px-4 py-16 text-center text-sm text-[color:var(--text-2)]">
              Loading calendar...
            </div>
          ) : null}

          <div className={loading ? 'hidden' : 'block'}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              firstDay={1}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'listWeek,timeGridDay,timeGridWeek,dayGridMonth',
              }}
              buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'Schedule' }}
              // Contained, internally-scrolling week grid; opens scrolled to ~now.
              height={720}
              expandRows
              stickyHeaderDates
              scrollTime={initialScrollTime}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short' }}
              nowIndicator
              dayMaxEvents={4}
              editable
              selectable
              eventContent={renderEventContent}
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
        <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.45)]">
          <button
            type="button"
            aria-label="Close detail panel"
            className="flex-1"
            onClick={() => setSelectedItem(null)}
          />
          <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="os-eyebrow">
                  {selectedTask ? 'Task detail' : 'Calendar event'}
                </p>
                <h2 className="os-section-title mt-2">
                  {selectedTask?.title ?? selectedEvent?.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--text-2)]"
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
                    <dt className="text-[color:var(--text-3)]">Due</dt>
                    <dd className="mt-1 text-[color:var(--text-2)]">
                      {formatTaskSchedule(
                        selectedTask.due_date,
                        selectedTask.due_time
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[color:var(--text-3)]">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[color:var(--text-2)]">
                      {selectedTask.description || 'No description yet.'}
                    </dd>
                  </div>
                </dl>

                {selectedTask.workstream_slug ? (
                  <Link
                    href={`/projects/${selectedTask.workstream_slug}`}
                    className="inline-flex items-center rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
                  >
                    View on board →
                  </Link>
                ) : null}
              </div>
            ) : selectedEvent ? (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const workstream = getWorkstreamById(
                      workstreams,
                      selectedEvent.workstream_id
                    )
                    return workstream ? (
                      <WorkstreamBadge
                        label={workstream.label}
                        slug={workstream.slug}
                        colour={workstream.colour}
                      />
                    ) : null
                  })()}
                  {selectedEvent.colour ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-2)]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: selectedEvent.colour }}
                      />
                      {selectedEvent.colour}
                    </span>
                  ) : null}
                  {selectedEvent.source && selectedEvent.source !== 'manual' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-2)]">
                      {selectedEvent.source === 'google' ? '↓ Google' : '↓ Feed'}
                    </span>
                  )}
                  {selectedEvent.read_only && (
                    <span className="inline-flex items-center rounded-full border border-[color:var(--amber)] bg-[var(--amber-dim)] px-2.5 py-1 text-xs font-medium text-[color:var(--amber-strong)]">
                      Read-only
                    </span>
                  )}
                </div>

                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-[color:var(--text-3)]">Date & time</dt>
                    <dd className="mt-1 text-[color:var(--text-2)]">
                      {formatDateRange(
                        selectedEvent.start_at,
                        selectedEvent.end_at,
                        selectedEvent.all_day
                      )}
                    </dd>
                  </div>
                  {selectedEvent.location ? (
                    <div>
                      <dt className="text-[color:var(--text-3)]">Location</dt>
                      <dd className="mt-1 text-[color:var(--text-2)]">
                        {selectedEvent.location}
                      </dd>
                    </div>
                  ) : null}
                  {selectedEvent.contact_id ? (
                    <div>
                      <dt className="text-[color:var(--text-3)]">Contact</dt>
                      <dd className="mt-1 text-[color:var(--text-2)]">
                        {getContactById(contacts, selectedEvent.contact_id)
                          ?.name ?? 'Unknown contact'}
                      </dd>
                    </div>
                  ) : null}
                  {selectedEvent.project_id ? (
                    <div>
                      <dt className="text-[color:var(--text-3)]">Project</dt>
                      <dd className="mt-1 text-[color:var(--text-2)]">
                        {projects.find((project) => project.id === selectedEvent.project_id)?.name ?? 'Unknown project'}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[color:var(--text-3)]">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-[color:var(--text-2)]">
                      {selectedEvent.description || 'No description yet.'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  {selectedEvent.meet_link ? (
                    <a
                      href={selectedEvent.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
                    >
                      🎥 Join Meet
                    </a>
                  ) : null}
                  {selectedEvent.html_link ? (
                    <a
                      href={selectedEvent.html_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
                    >
                      Open in Google Calendar
                    </a>
                  ) : null}
                  {!selectedEvent.read_only && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditForm(selectedEvent)}
                        className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(selectedEvent)}
                        className="rounded-2xl border border-[color:var(--red)] px-4 py-2.5 text-sm font-medium text-[color:var(--red-strong)] transition hover:bg-[var(--red-dim)]"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close event form"
            onClick={closeForm}
          />
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="os-eyebrow">
                  {editingEventId ? 'Edit event' : 'New event'}
                </p>
                <h2 className="os-section-title mt-2">
                  {editingEventId
                    ? 'Update calendar event'
                    : 'Create calendar event'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--text-2)]"
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-5">
              {formError ? (
                <div className="rounded-3xl border border-[color:var(--red)] bg-[var(--red-dim)] px-4 py-3 text-sm text-[color:var(--red-strong)]">
                  {formError}
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                  Title
                </span>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="os-input w-full px-4 py-3 text-sm"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      all_day: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-[color:var(--border)] bg-white"
                />
                <span className="text-sm text-[color:var(--text-2)]">All day</span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                    Start date
                  </span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_date: event.target.value,
                      }))
                    }
                    className="os-input w-full px-4 py-3 text-sm"
                  />
                </label>
                {!form.all_day ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                      Start time
                    </span>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_time: event.target.value,
                        }))
                      }
                      className="os-input w-full px-4 py-3 text-sm"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                    End date
                  </span>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        end_date: event.target.value,
                      }))
                    }
                    className="os-input w-full px-4 py-3 text-sm"
                  />
                </label>
                {!form.all_day ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                      End time
                    </span>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_time: event.target.value,
                        }))
                      }
                      className="os-input w-full px-4 py-3 text-sm"
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                    Location
                  </span>
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    className="os-input w-full px-4 py-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                    Workstream
                  </span>
                  <select
                    value={form.workstream_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        workstream_id: event.target.value,
                      }))
                    }
                    className="os-select w-full px-4 py-3 text-sm"
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

              {!editingEventId ? (
                <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                  <label className="flex items-center gap-3 text-sm font-medium text-[color:var(--text)]">
                    <input
                      type="checkbox"
                      checked={form.add_meet}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, add_meet: event.target.checked }))
                      }
                    />
                    <span>🎥 Add Google Meet link</span>
                  </label>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Attendees</span>
                    <input
                      value={form.attendees}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, attendees: event.target.value }))
                      }
                      placeholder="comma-separated emails"
                      className="os-input w-full px-4 py-3 text-sm"
                    />
                    {form.attendees.trim() ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {parseAttendees(form.attendees).map((email) => (
                          <span
                            key={email}
                            className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[color:var(--text-2)]"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-[color:var(--text-3)]">
                      Adding attendees will send them a Google Calendar invite.
                    </p>
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                  Project
                </span>
                <select
                  value={form.project_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      project_id: event.target.value,
                    }))
                  }
                  className="os-select w-full px-4 py-3 text-sm"
                >
                  <option value="">No project</option>
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-[color:var(--text-2)]">
                  Contact
                </span>
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search contacts"
                  className="os-input w-full px-4 py-3 text-sm"
                />
                <select
                  value={form.contact_id}
                  onChange={(event) => {
                    const nextContactId = event.target.value
                    const nextContact = contacts.find(
                      (contact) => contact.id === nextContactId
                    )
                    setForm((current) => ({
                      ...current,
                      contact_id: nextContactId,
                    }))
                    setContactSearch(nextContact?.name ?? '')
                  }}
                  className="os-select w-full px-4 py-3 text-sm"
                >
                  <option value="">No contact selected</option>
                  {filteredContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company
                        ? `${contact.name} — ${contact.company}`
                        : contact.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-[color:var(--text-2)]">
                  Colour
                </span>
                <div className="flex flex-wrap gap-3">
                  {EVENT_COLOURS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          colour: colour.value,
                        }))
                      }
                      className={`rounded-2xl border px-3 py-2 text-sm transition ${
                        form.colour === colour.value
                          ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                          : 'border-[color:var(--border)] text-[color:var(--text-2)] hover:border-[color:var(--accent)]'
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
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={5}
                  className="os-textarea w-full px-4 py-3 text-sm"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={handleSaveEvent}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {formSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {meetToast ? (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 shadow-2xl">
          <span className="text-sm text-[color:var(--text)]">🎥 Event created with a Meet link</span>
          <a
            href={meetToast}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            Open Meet
          </a>
          <button type="button" onClick={() => setMeetToast(null)} className="text-[color:var(--text-3)] hover:text-[color:var(--text)]">✕</button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteEventTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteEventTarget(null) }}
        title={`Delete "${deleteEventTarget?.title ?? 'event'}"?`}
        description="This event will be permanently removed from the calendar."
        confirmLabel="Delete event"
        onConfirm={() => void confirmDeleteEvent()}
        loading={deleteEventLoading}
        variant="destructive"
      />
    </>
  )
}
