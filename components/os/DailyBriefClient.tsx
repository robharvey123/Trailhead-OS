'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { getPriorityClasses, getWorkstreamColourClasses } from '@/lib/os'
import StatusBadge from './StatusBadge'
import type {
  DailyBriefCalendarEvent,
  DailyBriefData,
  DailyBriefDay,
  DailyBriefQuote,
  DailyBriefTask,
} from '@/lib/db/daily-brief'

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value)
}

function formatCompactDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatTimelineDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
  }).format(date)
}

function formatShortDate(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatEventTime(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat('en-GB', {
    timeStyle: 'short',
  }).format(date)
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getTaskHref(task: Pick<DailyBriefTask, 'workstream_slug'>) {
  if (task.workstream_slug) {
    return `/projects/${task.workstream_slug}`
  }

  return '/tasks'
}

function isOverdue(task: DailyBriefTask, todayKey: string) {
  return Boolean(task.due_date) && task.due_date! < todayKey
}

function getPriorityLabel(priority: DailyBriefTask['priority']) {
  if (priority === 'critical') {
    return 'URGENT'
  }

  return priority.toUpperCase()
}

function getAccentClasses(priority: DailyBriefTask['priority']) {
  if (priority === 'high') {
    return {
      border: 'border-l-amber-400',
      text: 'text-amber-200',
    }
  }

  return {
    border: 'border-l-rose-500',
    text: 'text-rose-200',
  }
}

function WorkstreamInline({
  task,
}: {
  task: Pick<DailyBriefTask, 'workstream_colour' | 'workstream_label' | 'workstream_slug'>
}) {
  const classes = getWorkstreamColourClasses(task.workstream_colour ?? task.workstream_slug)

  return (
    <span className="inline-flex items-center gap-2 text-slate-400">
      <span className={`h-2 w-2 rounded-full ${classes.dot}`} />
      <span>{task.workstream_label ?? 'Unassigned'}</span>
    </span>
  )
}

function PriorityPill({ priority }: { priority: DailyBriefTask['priority'] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getPriorityClasses(
        priority === 'critical' ? 'urgent' : priority
      )}`}
    >
      {getPriorityLabel(priority)}
    </span>
  )
}

function ActionRequiredRow({ task, todayKey }: { task: DailyBriefTask; todayKey: string }) {
  const accent = getAccentClasses(task.priority)
  const overdue = isOverdue(task, todayKey)

  return (
    <Link
      href={getTaskHref(task)}
      className={`block rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.74))] p-4 transition hover:border-slate-700 hover:bg-slate-950 border-l-4 ${accent.border}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accent.text}`}>
            {overdue ? 'Overdue' : 'Needs attention'}
          </p>
          <p className="font-medium text-slate-100">{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <WorkstreamInline task={task} />
            <span className="text-slate-600">·</span>
            <span className={overdue ? 'font-medium text-rose-300' : 'text-slate-400'}>
              {overdue ? `Overdue · ${formatShortDate(task.due_date ?? todayKey)}` : 'Due today'}
            </span>
          </div>
        </div>
        <PriorityPill priority={task.priority} />
      </div>
    </Link>
  )
}

function QuoteAttentionCard({ quote }: { quote: DailyBriefQuote }) {
  return (
    <Link
      href={`/quotes/${quote.id}`}
      className="block rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.72))] p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-950"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-100">{quote.account_name ?? 'Unassigned account'}</p>
          <p className="mt-2 text-sm text-slate-300">{quote.title}</p>
          {quote.summary ? <p className="mt-2 text-sm text-slate-500">{quote.summary}</p> : null}
        </div>
        <StatusBadge status={quote.status} kind="quote" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{formatShortDate(quote.created_at)}</span>
        <span>{quote.status === 'review' ? 'Ready to send' : 'Not yet reviewed'}</span>
      </div>
    </Link>
  )
}

function TimelineTask({ task }: { task: DailyBriefTask }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
      <WorkstreamInline task={task} />
      <span className="truncate text-slate-300">{task.title}</span>
    </div>
  )
}

function TimelineEvent({ event }: { event: DailyBriefCalendarEvent }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
      <span className="inline-flex h-2 w-2 rounded-full bg-sky-400" />
      <span className="truncate">{event.title}</span>
      <span className="text-slate-500">{event.all_day ? 'All day' : formatEventTime(event.start_at)}</span>
    </div>
  )
}

interface DailyBriefClientProps {
  today: string
  initialData: DailyBriefData
}

export default function DailyBriefClient({ today, initialData }: DailyBriefClientProps) {
  const [data, setData] = useState(initialData)
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const todayDate = useMemo(() => new Date(`${today}T00:00:00`), [today])

  const summary = useMemo(() => {
    const urgentActions = pluralize(data.actionRequired.length, 'urgent action', 'urgent actions')
    const totalToday = pluralize(
      data.actionRequired.length + data.todayTasks.length,
      'task today',
      'tasks today'
    )
    const quotes = `${data.quotesAttention.length} ${
      data.quotesAttention.length === 1 ? 'quote needs attention' : 'quotes need attention'
    }`

    return `${urgentActions} · ${totalToday} · ${quotes}`
  }, [data.actionRequired.length, data.quotesAttention.length, data.todayTasks.length])

  const statItems = useMemo(
    () => [
      {
        label: 'Urgent now',
        value: data.actionRequired.length,
        tone:
          data.actionRequired.length > 0
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
            : 'border-slate-700 bg-slate-900/80 text-slate-300',
      },
      {
        label: 'Due today',
        value: data.actionRequired.length + data.todayTasks.length,
        tone: 'border-sky-500/20 bg-sky-500/10 text-sky-100',
      },
      {
        label: 'Quotes',
        value: data.quotesAttention.length,
        tone:
          data.quotesAttention.length > 0
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-slate-700 bg-slate-900/80 text-slate-300',
      },
    ],
    [data.actionRequired.length, data.quotesAttention.length, data.todayTasks.length]
  )

  async function handleComplete(taskId: string) {
    if (pendingTaskIds.includes(taskId)) {
      return
    }

    const previousData = data
    setError(null)
    setPendingTaskIds((current) => [...current, taskId])
    setData((current) => ({
      ...current,
      todayTasks: current.todayTasks.filter((task) => task.id !== taskId),
      weekAhead: current.weekAhead.map((day) => ({
        ...day,
        tasks: day.tasks.filter((task) => task.id !== taskId),
      })),
    }))

    try {
      await apiFetch<{ ok: true }>(`/api/os/tasks/${taskId}`, { method: 'DELETE' })
    } catch (completeError) {
      setData(previousData)
      setError(completeError instanceof Error ? completeError.message : 'Failed to complete task')
    } finally {
      setPendingTaskIds((current) => current.filter((id) => id !== taskId))
    }
  }

  return (
    <div className="mx-auto max-w-[780px] space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.88))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.32)]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Daily brief</p>
          <h1 className="text-3xl font-semibold text-slate-50">{formatLongDate(todayDate)}</h1>
          <p className="max-w-2xl text-sm text-slate-300">{summary}</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {statItems.map((item) => (
            <div key={item.label} className={`rounded-3xl border px-4 py-4 ${item.tone}`}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-inherit/70">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-inherit">{item.value}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Priority queue</p>
            <h2 className="text-lg font-semibold text-slate-100">Action required</h2>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-300">
            {data.actionRequired.length}
          </span>
        </div>
        <p className="text-sm text-slate-400">Urgent and high-priority tasks due today or already overdue.</p>

        <div className="mt-5 space-y-3">
          {data.actionRequired.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6">
              <p className="text-sm font-medium text-slate-300">Nothing urgent today.</p>
              <p className="mt-1 text-sm text-slate-500">The immediate queue is clear.</p>
            </div>
          ) : (
            data.actionRequired.map((task) => <ActionRequiredRow key={task.id} task={task} todayKey={today} />)
          )}
        </div>
      </section>

      {data.quotesAttention.length > 0 ? (
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Commercial</p>
              <h2 className="text-lg font-semibold text-slate-100">Quotes needing attention</h2>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-300">
              {data.quotesAttention.length}
            </span>
          </div>
          <p className="text-sm text-slate-400">Drafts and reviews that still need movement.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.quotesAttention.map((quote) => (
              <QuoteAttentionCard key={quote.id} quote={quote} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Execution</p>
            <h2 className="text-lg font-semibold text-slate-100">Today&apos;s remaining tasks</h2>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-300">
            {data.todayTasks.length}
          </span>
        </div>
        <p className="text-sm text-slate-400">Everything due today outside the urgent queue.</p>

        <div className="mt-5 space-y-3">
          {data.todayTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6">
              <p className="text-sm font-medium text-slate-300">No remaining tasks due today.</p>
              <p className="mt-1 text-sm text-slate-500">Only the urgent queue is left, or today is already clear.</p>
            </div>
          ) : (
            data.todayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-4 rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.72))] p-4"
              >
                <button
                  type="button"
                  onClick={() => void handleComplete(task.id)}
                  disabled={pendingTaskIds.includes(task.id)}
                  aria-label={`Mark ${task.title} complete`}
                  className={`mt-0.5 h-5 w-5 rounded-full border transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                    pendingTaskIds.includes(task.id)
                      ? 'border-emerald-400 bg-emerald-400/20 ring-4 ring-emerald-400/10'
                      : 'border-slate-500'
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={getTaskHref(task)} className="font-medium text-slate-100 transition hover:text-white">
                        {task.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                        <span>Due today</span>
                        <span className="text-slate-600">·</span>
                        <WorkstreamInline task={task} />
                      </div>
                    </div>
                    {task.priority !== 'low' ? <PriorityPill priority={task.priority} /> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Calendar</p>
            <h2 className="text-lg font-semibold text-slate-100">This week</h2>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-300">
            {data.weekAhead.length} days
          </span>
        </div>
        <p className="text-sm text-slate-400">Due dates and calendar events from today through the next seven days.</p>

        <div className="mt-5 space-y-3">
          {data.weekAhead.map((day: DailyBriefDay) => {
            const isToday = day.date === today

            return (
              <div
                key={day.date}
                className={`grid gap-3 rounded-3xl border px-4 py-4 md:grid-cols-[104px_minmax(0,1fr)] md:gap-6 ${
                  isToday
                    ? 'border-sky-500/30 bg-sky-500/5'
                    : 'border-slate-800 bg-slate-950/35'
                }`}
              >
                <div className="space-y-1">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      isToday
                        ? 'bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {formatTimelineDate(day.date)}
                  </span>
                  <p className="text-xs text-slate-500">{formatCompactDate(day.date)}</p>
                </div>

                <div className="space-y-2">
                  {day.tasks.length === 0 && day.events.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-800 px-3 py-3 text-sm text-slate-500">
                      Nothing scheduled
                    </p>
                  ) : (
                    <>
                      {day.tasks.map((task) => (
                        <TimelineTask key={task.id} task={task} />
                      ))}
                      {day.events.map((event) => (
                        <TimelineEvent key={event.id} event={event} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  )
}