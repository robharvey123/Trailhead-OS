"use client"

import { useEffect, useMemo, useState } from 'react'
import DashboardCharts from '../dashboard/DashboardCharts'
import DashboardInsights from '../dashboard/DashboardInsights'
import DashboardTable from '../dashboard/DashboardTable'
import CompanySummaryTable from '../company-summary/CompanySummaryTable'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { InsightsData } from '@/lib/insights/data'

type ReportType = 'exec' | 'detailed'

type InsightsNarrative = {
  title: string
  summary: string
  highlights: string[]
  risks: string[]
  actions: string[]
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InsightsClient({
  workspaceId,
  data,
  recipients: initialRecipients,
}: {
  workspaceId: string
  data: InsightsData
  recipients: string[]
}) {
  const [reportType, setReportType] = useState<ReportType>('exec')
  const [includeFinancials, setIncludeFinancials] = useState(false)
  const [report, setReport] = useState<InsightsNarrative | null>(null)
  const [reportMessage, setReportMessage] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [recipients, setRecipients] = useState<string[]>(
    initialRecipients ?? []
  )
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(
    initialRecipients ?? []
  )
  const [newRecipient, setNewRecipient] = useState('')
  const [isSavingRecipients, setIsSavingRecipients] = useState(false)
  const [recipientMessage, setRecipientMessage] = useState('')

  useEffect(() => {
    setReport(null)
    setReportMessage(null)
  }, [reportType, includeFinancials, data.brand, data.start, data.end])

  const metrics = useMemo(() => {
    const base = [
      {
        label: 'Total Sell In',
        value: formatNumber(data.totals.sellIn),
      },
      {
        label: 'Promo Stock (FOC)',
        value: formatNumber(data.totals.promo),
      },
      {
        label: 'Total Shipped',
        value: formatNumber(data.totals.totalShipped),
      },
      {
        label: 'Total Sell Out',
        value: formatNumber(data.totals.sellOut),
      },
      {
        label: 'Channel Stock Build',
        value: formatNumber(data.totals.channelStock),
      },
      {
        label: 'Sell Through',
        value: formatPercent(data.totals.sellThrough),
      },
    ]

    if (!includeFinancials) {
      return base
    }

    return [
      ...base,
      {
        label: 'Revenue',
        value: formatCurrency(data.totals.revenue, data.currencySymbol),
      },
      {
        label: 'COGS',
        value: formatCurrency(data.totals.cogs, data.currencySymbol),
      },
      {
        label: 'Gross Profit',
        value: formatCurrency(data.totals.grossProfit, data.currencySymbol),
      },
      {
        label: 'FOC Stock Cost',
        value: formatCurrency(data.totals.promoCost, data.currencySymbol),
      },
      {
        label: 'Net Contribution',
        value: formatCurrency(data.totals.netContribution, data.currencySymbol),
      },
    ]
  }, [data, includeFinancials])

  const totalsRow = useMemo(() => {
    return {
      month: 'Total',
      sellIn: formatNumber(data.totals.sellIn),
      promo: formatNumber(data.totals.promo),
      totalShipped: formatNumber(data.totals.totalShipped),
      sellOut: formatNumber(data.totals.sellOut),
      variance: formatNumber(data.totals.totalShipped - data.totals.sellOut),
    }
  }, [data])

  const companyTotalsRow = useMemo(() => {
    return {
      company: 'Total',
      sellIn: formatNumber(data.companyTotals.sellIn),
      promo: formatNumber(data.companyTotals.promo),
      totalShipped: formatNumber(data.companyTotals.totalShipped),
      sellOut: formatNumber(data.companyTotals.sellOut),
      channelStock: formatNumber(data.companyTotals.channelStock),
      sellThrough: formatPercent(data.companyTotals.sellThrough),
      revenue: formatCurrency(data.companyTotals.revenue, data.currencySymbol),
    }
  }, [data])

  const toggleRecipient = (email: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    )
  }

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase()
    if (!emailRegex.test(email)) {
      setRecipientMessage('Enter a valid email address.')
      return
    }
    if (recipients.includes(email)) {
      setRecipientMessage('Email already added.')
      return
    }
    const updated = [...recipients, email]
    setRecipients(updated)
    setSelectedRecipients((prev) => [...prev, email])
    setNewRecipient('')
    setRecipientMessage('')
  }

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((item) => item !== email))
    setSelectedRecipients((prev) => prev.filter((item) => item !== email))
  }

  const saveRecipients = async () => {
    setIsSavingRecipients(true)
    setRecipientMessage('')
    try {
      const response = await fetch('/api/insights/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, recipients }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save recipients.')
      }
      setRecipientMessage('Recipients saved.')
    } catch (error) {
      setRecipientMessage(
        error instanceof Error ? error.message : 'Failed to save recipients.'
      )
    } finally {
      setIsSavingRecipients(false)
    }
  }

  const generateReport = async () => {
    setIsGenerating(true)
    setReportMessage(null)
    try {
      const response = await fetch('/api/insights/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          brand: data.brand,
          start: data.start,
          end: data.end,
          reportType,
          includeFinancials,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to generate report.')
      }
      setReport(payload.report)
      return payload.report as InsightsNarrative
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate report.'
      setReportMessage({ tone: 'error', text: message })
      throw new Error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const ensureReport = async () => {
    if (report) {
      return report
    }
    return generateReport()
  }

  const downloadPdf = async () => {
    setIsDownloading(true)
    try {
      const currentReport = await ensureReport()
      const response = await fetch('/api/insights/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          brand: data.brand,
          start: data.start,
          end: data.end,
          reportType,
          includeFinancials,
          report: currentReport,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to generate PDF.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'snop-report.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setReportMessage({
        tone: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to download PDF.',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const sendEmail = async () => {
    setIsSending(true)
    setReportMessage(null)
    try {
      if (!selectedRecipients.length) {
        throw new Error('Select at least one recipient.')
      }
      const currentReport = await ensureReport()
      const response = await fetch('/api/insights/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          brand: data.brand,
          start: data.start,
          end: data.end,
          reportType,
          includeFinancials,
          recipients: selectedRecipients,
          report: currentReport,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to send email.')
      }
      setReportMessage({ tone: 'success', text: 'Report emailed successfully.' })
    } catch (error) {
      setReportMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to send email.',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Report controls</h2>
            <p className="mt-2 text-sm text-slate-300">
              Tune the narrative output and share your report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateReport}
              disabled={isGenerating}
              className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-70"
            >
              {isGenerating ? 'Generating...' : 'Generate summary'}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={isDownloading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-70"
            >
              {isDownloading ? 'Preparing...' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={sendEmail}
              disabled={isSending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-70"
            >
              {isSending ? 'Sending...' : 'Send email'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Report type
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={reportType === 'exec'}
                  onChange={() => setReportType('exec')}
                  className="accent-white"
                />
                Exec summary
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={reportType === 'detailed'}
                  onChange={() => setReportType('detailed')}
                  className="accent-white"
                />
                Detailed
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Financials
            </p>
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={includeFinancials}
                onChange={(event) => setIncludeFinancials(event.target.checked)}
                className="h-4 w-4 accent-white"
              />
              Include revenue and contribution metrics
            </label>
            <p className="mt-3 text-xs text-slate-400">
              Toggle to show or hide financial KPIs in the report and summary
              cards.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Recipients
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {recipients.length ? (
                recipients.map((email) => (
                  <label
                    key={email}
                    className="flex items-center justify-between gap-2 text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(email)}
                        onChange={() => toggleRecipient(email)}
                        className="accent-white"
                      />
                      {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Remove
                    </button>
                  </label>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  Add recipients to enable email sharing.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newRecipient}
                onChange={(event) => setNewRecipient(event.target.value)}
                placeholder="name@company.com"
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-200"
              >
                Add
              </button>
              <button
                type="button"
                onClick={saveRecipients}
                disabled={isSavingRecipients}
                className="rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-70"
              >
                {isSavingRecipients ? 'Saving...' : 'Save'}
              </button>
            </div>
            {recipientMessage ? (
              <p className="mt-2 text-xs text-slate-400">{recipientMessage}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">AI summary</h2>
        <p className="mt-2 text-sm text-slate-300">
          Use Generate summary to refresh the narrative for this period.
        </p>
        {reportMessage ? (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              reportMessage.tone === 'error'
                ? 'border border-rose-900/50 bg-rose-950/30 text-rose-200'
                : 'border border-emerald-900/50 bg-emerald-950/30 text-emerald-200'
            }`}
          >
            {reportMessage.text}
          </div>
        ) : null}
        {report ? (
          <div className="mt-6 space-y-6 text-sm text-slate-200">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Summary
              </p>
              <p className="mt-2">{report.summary}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Highlights
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {report.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Risks
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {report.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Actions
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {report.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-400">
            Generate a report to see highlights, risks, and suggested actions.
          </p>
        )}
      </section>

      <DashboardCharts data={data.chartData} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Monthly summary</h2>
        <p className="mt-2 text-sm text-slate-300">
          Sell in, promo, shipments, sell out, and variance by month.
        </p>
        <div className="mt-6">
          <DashboardTable data={data.monthlySummary} totals={totalsRow} />
        </div>
      </section>

      <DashboardInsights
        aspData={data.aspData}
        promoRateData={data.promoRateData}
        platformData={data.platformData}
        regionData={data.regionData}
        topCustomerRevenue={data.topCustomerRevenue}
        topCompanySellOut={data.topCompanySellOut}
        currencySymbol={data.currencySymbol}
      />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Inbound vs outbound by company</h2>
        <p className="mt-2 text-sm text-slate-300">
          Sell-in volumes mapped to sell-out companies with channel stock build.
        </p>
        <div className="mt-6">
          <CompanySummaryTable
            data={data.companySummary}
            totals={companyTotalsRow}
            currencySymbol={data.currencySymbol}
            showFinancials={includeFinancials}
          />
        </div>
      </section>
    </div>
  )
}
