'use client'

import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useForm } from 'react-hook-form'
import {
  SELL_IN_HEADERS,
  SELL_IN_TEMPLATE,
  SELL_OUT_HEADERS,
  SELL_OUT_TEMPLATE,
} from '@/lib/import/templates'

type ImportMode = 'append' | 'replace'

type ImportResult = {
  inserted: number
  rejected: { row: number; reason: string }[]
}

type ImportSectionConfig = {
  title: string
  description: string
  endpoint: string
  expectedHeaders: string[]
  template: string
  dateField: 'date' | 'month'
}

type ImportFormValues = {
  mode: ImportMode
}

type ParsedFile = {
  rows: Record<string, unknown>[]
  errors: string[]
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

const serializeCell = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  return value
}

const isEmptyRow = (row: Record<string, unknown>) =>
  Object.values(row).every(
    (value) => value === null || value === undefined || String(value).trim() === ''
  )

const parseCsvFile = async (
  file: File,
  expectedHeaders: string[]
): Promise<ParsedFile> => {
  const text = await file.text()
  const { data, meta } = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const normalizedRows = data
    .map((row) => {
      const normalized: Record<string, unknown> = {}
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = normalizeHeader(key)
        normalized[normalizedKey] = serializeCell(value)
      })
      return normalized
    })
    .filter((row) => !isEmptyRow(row))

  const headerKeys = (meta.fields ?? []).map(normalizeHeader)
  const missing = expectedHeaders.filter(
    (header) => !headerKeys.includes(header)
  )

  return {
    rows: normalizedRows,
    errors: missing.length
      ? [`Missing required columns: ${missing.join(', ')}`]
      : [],
  }
}

const parseExcelFile = async (
  file: File,
  expectedHeaders: string[]
): Promise<ParsedFile> => {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    return { rows: [], errors: ['Excel file has no sheets.'] }
  }

  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  if (!data.length) {
    return { rows: [], errors: ['Excel sheet is empty.'] }
  }

  const normalizedRows = data
    .map((row) => {
      const normalized: Record<string, unknown> = {}
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = normalizeHeader(key)
        normalized[normalizedKey] = serializeCell(value)
      })
      return normalized
    })
    .filter((row) => !isEmptyRow(row))

  const headerKeys = Object.keys(data[0] ?? {}).map(normalizeHeader)
  const missing = expectedHeaders.filter(
    (header) => !headerKeys.includes(header)
  )

  return {
    rows: normalizedRows,
    errors: missing.length
      ? [`Missing required columns: ${missing.join(', ')}`]
      : [],
  }
}

const parseFile = async (
  file: File,
  expectedHeaders: string[]
): Promise<ParsedFile> => {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    return parseExcelFile(file, expectedHeaders)
  }

  return parseCsvFile(file, expectedHeaders)
}

const downloadTemplate = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const formatDateRange = (dates: string[], fieldLabel: string) => {
  if (!dates.length) {
    return `No ${fieldLabel} values detected.`
  }

  const sorted = [...dates].sort()
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return `${fieldLabel}: ${min} → ${max}`
}

const ImportSection = ({
  workspaceId,
  config,
}: {
  workspaceId: string
  config: ImportSectionConfig
}) => {
  const { register, handleSubmit, watch, reset } = useForm<ImportFormValues>({
    defaultValues: { mode: 'append' },
  })
  const mode = watch('mode')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const brandSummary = useMemo(() => {
    const brands = Array.from(
      new Set(rows.map((row) => String(row.brand ?? '').trim()).filter(Boolean))
    )
    return brands.length ? `Brands: ${brands.join(', ')}` : 'No brands detected.'
  }, [rows])

  const dateSummary = useMemo(() => {
    const values = rows
      .map((row) => String(row[config.dateField] ?? '').trim())
      .filter(Boolean)
    const label = config.dateField === 'date' ? 'Dates' : 'Months'
    return formatDateRange(values, label)
  }, [rows, config.dateField])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setResult(null)

    if (!file) {
      setFileName(null)
      setRows([])
      setParseErrors([])
      return
    }

    setFileName(file.name)
    const parsed = await parseFile(file, config.expectedHeaders)
    setRows(parsed.rows)
    setParseErrors(parsed.errors)
  }

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true)
    setResult(null)

    if (!rows.length) {
      setParseErrors((prev) =>
        prev.length ? prev : ['Please upload a file with data rows.']
      )
      setIsSubmitting(false)
      return
    }

    if (parseErrors.length) {
      setIsSubmitting(false)
      return
    }

    try {
      const chunkSize = 500
      const chunks = chunkArray(rows, chunkSize)
      let totalInserted = 0
      const allRejected: ImportResult['rejected'] = []

      for (let i = 0; i < chunks.length; i += 1) {
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            mode: i === 0 ? values.mode : 'append',
            rows: chunks[i],
            rowOffset: i * chunkSize + 1,
          }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setParseErrors([payload.error ?? 'Import failed.'])
          setIsSubmitting(false)
          return
        }

        totalInserted += payload.inserted ?? 0
        allRejected.push(...(payload.rejected ?? []))
      }

      setResult({ inserted: totalInserted, rejected: allRejected })
      setParseErrors([])
      reset({ mode: values.mode })
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : 'Unexpected import error.',
      ])
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-300">{config.description}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadTemplate(`${config.title}.csv`, config.template)}
          className="rounded-full border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Download template
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Upload {config.title} file
            </span>
            <span className="text-sm text-slate-200">
              {fileName ?? 'Select CSV or Excel'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Import mode
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="append"
                  className="accent-white"
                  {...register('mode')}
                />
                Append to existing data
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="replace"
                  className="accent-white"
                  {...register('mode')}
                />
                Replace for brand + date range
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <div>{brandSummary}</div>
          <div>{dateSummary}</div>
          <div>Rows detected: {rows.length}</div>
        </div>

        {parseErrors.length ? (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {parseErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !rows.length}
          className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Importing...' : `Import ${config.title}`}
        </button>
      </form>

      {result ? (
        <div className="mt-6 space-y-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          <div>Inserted rows: {result.inserted}</div>
          <div>Rejected rows: {result.rejected.length}</div>
          {result.rejected.length ? (
            <div className="max-h-40 space-y-1 overflow-auto text-xs text-emerald-100">
              {result.rejected.map((item) => (
                <p key={`${item.row}-${item.reason}`}>
                  Row {item.row}: {item.reason}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'replace' ? (
        <p className="mt-4 text-xs text-slate-400">
          Replace deletes existing rows for the detected brand(s) within the
          detected date range.
        </p>
      ) : null}
    </div>
  )
}

export default function ImportClient({
  workspaceId,
}: {
  workspaceId: string
}) {
  const configs: ImportSectionConfig[] = [
    {
      title: 'Sell In',
      description:
        'Import customer shipments including promo cans, unit pricing, and totals.',
      endpoint: '/api/import/sell-in',
      expectedHeaders: SELL_IN_HEADERS,
      template: SELL_IN_TEMPLATE,
      dateField: 'date',
    },
    {
      title: 'Sell Out',
      description:
        'Import sell-out by company, platform, and region with monthly granularity.',
      endpoint: '/api/import/sell-out',
      expectedHeaders: SELL_OUT_HEADERS,
      template: SELL_OUT_TEMPLATE,
      dateField: 'month',
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Imports
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Import data</h1>
        <p className="mt-2 text-sm text-slate-300">
          Upload CSV or Excel files to keep workspace data up to date. Row
          numbers in errors refer to data rows (excluding headers).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {configs.map((config) => (
          <ImportSection
            key={config.title}
            workspaceId={workspaceId}
            config={config}
          />
        ))}
      </div>
    </div>
  )
}
