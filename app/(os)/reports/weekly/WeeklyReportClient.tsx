'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { WeeklyReportData } from '@/lib/db/weekly-report'

const WORKSTREAM_COLOUR_MAP: Record<string, string> = {
  teal: 'bg-teal-400',
  amber: 'bg-amber-400',
  purple: 'bg-purple-400',
  green: 'bg-emerald-400',
  coral: 'bg-pink-400',
}

const WORKSTREAM_TEXT_MAP: Record<string, string> = {
  teal: 'text-teal-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
  green: 'text-emerald-400',
  coral: 'text-pink-400',
}

export default function WeeklyReportClient({ initialData }: { initialData: WeeklyReportData }) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  async function generateNarrative() {
    setNarrativeLoading(true)
    try {
      const result = await apiFetch<WeeklyReportData>('/api/reports/weekly?narrative=true')
      setData(result)
    } catch {
      // silent
    } finally {
      setNarrativeLoading(false)
    }
  }

  async function downloadPdf() {
    setPdfLoading(true)
    try {
      const response = await fetch('/api/reports/weekly?format=pdf&narrative=true')
      if (!response.ok) throw new Error('PDF generation failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `weekly-report-${data.startDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent
    } finally {
      setPdfLoading(false)
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      const result = await apiFetch<WeeklyReportData>('/api/reports/weekly?narrative=false')
      setData(result)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const { taskSummary, workstreams, projectSummary, narrative } = data

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="os-eyebrow text-[color:var(--accent-strong)]">
            WEEKLY REPORT
          </p>
          <h1 className="os-page-title mt-1">{data.weekLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void generateNarrative()}
            disabled={narrativeLoading}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {narrativeLoading ? 'Generating...' : 'Generate AI briefing'}
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={pdfLoading}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Task stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Open" value={taskSummary.total} />
        <StatCard label="Completed" value={taskSummary.completed} colour="text-[color:var(--accent-strong)]" />
        <StatCard label="Added" value={taskSummary.added} />
        <StatCard label="Overdue" value={taskSummary.overdue} colour={taskSummary.overdue > 0 ? 'text-[color:var(--red-strong)]' : undefined} />
        <StatCard label="Due soon" value={taskSummary.dueSoon} colour="text-[color:var(--amber-strong)]" />
      </div>

      {/* Workstreams */}
      <section>
        <p className="os-eyebrow mb-3 text-[color:var(--accent-strong)]">
          WORKSTREAMS
        </p>
        <div className="os-card divide-y divide-[color:var(--border)]">
          {workstreams.map((ws) => (
            <div key={ws.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${WORKSTREAM_COLOUR_MAP[ws.colour] ?? 'bg-gray-400'}`} />
                <span className="font-medium text-[color:var(--text)]">{ws.label}</span>
              </div>
              <div className="flex items-center gap-5 text-sm text-[color:var(--text-2)]">
                <span>{ws.openTasks} open</span>
                <span className="text-[color:var(--accent-strong)]">{ws.completedThisWeek} done</span>
                <span>{ws.dueThisWeek} due</span>
                {ws.overdue > 0 ? (
                  <span className="text-[color:var(--red-strong)]">{ws.overdue} overdue</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      {projectSummary.length > 0 ? (
        <section>
          <p className="os-eyebrow mb-3 text-[color:var(--accent-strong)]">
            ACTIVE PROJECTS
          </p>
          <div className="os-card divide-y divide-[color:var(--border)]">
            {projectSummary.map((proj) => {
              const pct = proj.task_count > 0 ? Math.round((proj.completed_task_count / proj.task_count) * 100) : 0
              return (
                <div key={proj.id} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate font-medium text-[color:var(--text)]">{proj.name}</p>
                    {proj.workstream_label ? (
                      <p className={`text-xs ${WORKSTREAM_TEXT_MAP[proj.workstream_colour ?? ''] ?? 'text-[color:var(--text-2)]'}`}>
                        {proj.workstream_label}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-5 text-sm text-[color:var(--text-2)]">
                    <span>
                      {proj.completed_task_count}/{proj.task_count} tasks ({pct}%)
                    </span>
                    {proj.next_milestone ? (
                      <span className="text-[color:var(--amber-strong)]">→ {proj.next_milestone}</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Narrative */}
      {narrative ? (
        <section>
          <p className="os-eyebrow mb-3 text-[color:var(--accent-strong)]">
            AI BRIEFING
          </p>
          <div className="os-card p-6">
            <p className="whitespace-pre-wrap leading-relaxed text-[color:var(--text-2)]">{narrative}</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, colour }: { label: string; value: number; colour?: string }) {
  return (
    <div className="os-card px-4 py-5 text-center">
      <p className={`text-3xl font-bold ${colour ?? 'text-[color:var(--text)]'}`}>{value}</p>
      <p className="os-eyebrow mt-1 tracking-[2px] text-[color:var(--text-3)]">{label}</p>
    </div>
  )
}
