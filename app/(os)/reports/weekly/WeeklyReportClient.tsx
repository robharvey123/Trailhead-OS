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
          <p className="text-[10px] font-bold tracking-[3px] uppercase text-[#B8FF00]">
            WEEKLY REPORT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{data.weekLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-white hover:border-[#B8FF00]/30 disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void generateNarrative()}
            disabled={narrativeLoading}
            className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-white hover:border-[#B8FF00]/30 disabled:opacity-60"
          >
            {narrativeLoading ? 'Generating...' : 'Generate AI briefing'}
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={pdfLoading}
            className="rounded-2xl bg-[#B8FF00] px-4 py-2 text-sm font-bold text-[#0C0C14] disabled:opacity-60"
          >
            {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Task stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Open" value={taskSummary.total} />
        <StatCard label="Completed" value={taskSummary.completed} colour="text-[#B8FF00]" />
        <StatCard label="Added" value={taskSummary.added} />
        <StatCard label="Overdue" value={taskSummary.overdue} colour={taskSummary.overdue > 0 ? 'text-[#FF4081]' : undefined} />
        <StatCard label="Due soon" value={taskSummary.dueSoon} colour="text-amber-400" />
      </div>

      {/* Workstreams */}
      <section>
        <p className="mb-3 text-[10px] font-bold tracking-[3px] uppercase text-[#B8FF00]">
          WORKSTREAMS
        </p>
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] divide-y divide-[#2A2A3A]">
          {workstreams.map((ws) => (
            <div key={ws.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${WORKSTREAM_COLOUR_MAP[ws.colour] ?? 'bg-gray-400'}`} />
                <span className="font-medium text-white">{ws.label}</span>
              </div>
              <div className="flex items-center gap-5 text-sm text-[#9CA3AF]">
                <span>{ws.openTasks} open</span>
                <span className="text-[#B8FF00]">{ws.completedThisWeek} done</span>
                <span>{ws.dueThisWeek} due</span>
                {ws.overdue > 0 ? (
                  <span className="text-[#FF4081]">{ws.overdue} overdue</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      {projectSummary.length > 0 ? (
        <section>
          <p className="mb-3 text-[10px] font-bold tracking-[3px] uppercase text-[#B8FF00]">
            ACTIVE PROJECTS
          </p>
          <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] divide-y divide-[#2A2A3A]">
            {projectSummary.map((proj) => {
              const pct = proj.task_count > 0 ? Math.round((proj.completed_task_count / proj.task_count) * 100) : 0
              return (
                <div key={proj.id} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate font-medium text-white">{proj.name}</p>
                    {proj.workstream_label ? (
                      <p className={`text-xs ${WORKSTREAM_TEXT_MAP[proj.workstream_colour ?? ''] ?? 'text-[#9CA3AF]'}`}>
                        {proj.workstream_label}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-5 text-sm text-[#9CA3AF]">
                    <span>
                      {proj.completed_task_count}/{proj.task_count} tasks ({pct}%)
                    </span>
                    {proj.next_milestone ? (
                      <span className="text-amber-400">→ {proj.next_milestone}</span>
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
          <p className="mb-3 text-[10px] font-bold tracking-[3px] uppercase text-[#B8FF00]">
            AI BRIEFING
          </p>
          <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-6">
            <p className="whitespace-pre-wrap leading-relaxed text-[#9CA3AF]">{narrative}</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, colour }: { label: string; value: number; colour?: string }) {
  return (
    <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] px-4 py-5 text-center">
      <p className={`text-3xl font-bold ${colour ?? 'text-white'}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold tracking-[2px] uppercase text-[#9CA3AF]">{label}</p>
    </div>
  )
}
