'use client'

import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { useForm } from 'react-hook-form'
import {
  SELL_IN_HEADERS,
  SELL_IN_TEMPLATE,
  SELL_OUT_HEADERS,
  SELL_OUT_TEMPLATE,
} from '@/lib/import/templates'

type ImportMode = 'append' | 'replace' | 'update'

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

type ManualFieldConfig = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'month'
  placeholder?: string
  optional?: boolean
  options?: string[]
  defaultValue?: string
  allowAdd?: boolean
}

type ManualEntryConfig = {
  title: string
  description: string
  endpoint: string
  expectedHeaders: string[]
  requiredKeys: string[]
  fields: ManualFieldConfig[]
}

type ManualOptions = {
  sellIn: {
    customers: string[]
    brands: string[]
    products: string[]
    countries: string[]
  }
  sellOut: {
    companies: string[]
    brands: string[]
    products: string[]
    platforms: string[]
    regions: string[]
  }
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
    delimiter: '',
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

const normalizeExcelCell = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (value && typeof value === 'object') {
    if ('text' in value && typeof (value as { text?: string }).text === 'string') {
      return (value as { text?: string }).text ?? ''
    }
    if ('richText' in value) {
      const rich = (value as { richText?: { text: string }[] }).richText ?? []
      return rich.map((item) => item.text).join('')
    }
    if ('result' in value) {
      return (value as { result?: unknown }).result ?? ''
    }
  }

  return value ?? ''
}

const parseExcelFile = async (
  file: File,
  expectedHeaders: string[]
): Promise<ParsedFile> => {
  const { Workbook } = await import('exceljs')
  const buffer = await file.arrayBuffer()
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]

  if (!sheet) {
    return { rows: [], errors: ['Excel file has no sheets.'] }
  }

  const headerRow = sheet.getRow(1)
  const headerValues = Array.isArray(headerRow?.values)
    ? headerRow.values
    : Object.values(headerRow?.values ?? {})
  const rawHeaders = headerValues
    .slice(1)
    .map((value) => String(value ?? '').trim())
  const headerKeys = rawHeaders.map(normalizeHeader).filter(Boolean)

  const missing = expectedHeaders.filter(
    (header) => !headerKeys.includes(header)
  )

  const normalizedRows: Record<string, unknown>[] = []
  const rowCount = sheet.rowCount

  for (let rowIndex = 2; rowIndex <= rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex)
    const normalized: Record<string, unknown> = {}

    rawHeaders.forEach((header, headerIndex) => {
      const normalizedKey = normalizeHeader(header)
      if (!normalizedKey) {
        return
      }
      const cellValue = normalizeExcelCell(row.getCell(headerIndex + 1).value)
      normalized[normalizedKey] = serializeCell(cellValue)
    })

    if (!isEmptyRow(normalized)) {
      normalizedRows.push(normalized)
    }
  }

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

const parseTextRows = (
  text: string,
  expectedHeaders: string[]
): ParsedFile => {
  const { data, meta } = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimiter: '',
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
  return `${fieldLabel}: ${min} -> ${max}`
}

const ManualEntrySection = ({
  workspaceId,
  config,
}: {
  workspaceId: string
  config: ManualEntryConfig
}) => {
  const emptyForm = useMemo(
    () =>
      config.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.defaultValue ?? ''
        return acc
      }, {}),
    [config.fields]
  )

  const [optionsMap, setOptionsMap] = useState<Record<string, string[]>>(() =>
    config.fields.reduce<Record<string, string[]>>((acc, field) => {
      if (field.options?.length) {
        acc[field.key] = [...field.options].sort((a, b) => a.localeCompare(b))
      }
      return acc
    }, {})
  )
  const [formValues, setFormValues] = useState<Record<string, string>>(
    emptyForm
  )
  const [queue, setQueue] = useState<Record<string, unknown>[]>([])
  const [pasteText, setPasteText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const addOption = (key: string, value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    setOptionsMap((prev) => {
      const current = prev[key] ?? []
      const exists = current.some(
        (option) => option.toLowerCase() === trimmed.toLowerCase()
      )
      if (exists) {
        return prev
      }
      return {
        ...prev,
        [key]: [...current, trimmed].sort((a, b) => a.localeCompare(b)),
      }
    })
  }

  const handleAddRow = () => {
    const missing = config.requiredKeys.filter(
      (key) => !String(formValues[key] ?? '').trim()
    )

    if (missing.length) {
      setErrors([`Missing required fields: ${missing.join(', ')}`])
      return
    }

    setQueue((prev) => [...prev, { ...formValues }])
    config.fields.forEach((field) => {
      if (field.allowAdd) {
        addOption(field.key, String(formValues[field.key] ?? ''))
      }
    })
    setFormValues(emptyForm)
    setErrors([])
    setResult(null)
  }

  const handlePasteRows = () => {
    if (!pasteText.trim()) {
      setErrors(['Paste CSV/TSV rows including headers.'])
      return
    }

    const parsed = parseTextRows(pasteText, config.expectedHeaders)
    if (parsed.errors.length) {
      setErrors(parsed.errors)
      return
    }

    if (!parsed.rows.length) {
      setErrors(['No rows detected in the pasted data.'])
      return
    }

    setQueue((prev) => [...prev, ...parsed.rows])
    config.fields.forEach((field) => {
      if (!field.allowAdd) {
        return
      }
      parsed.rows.forEach((row) => {
        addOption(field.key, String(row[field.key] ?? ''))
      })
    })
    setPasteText('')
    setErrors([])
    setResult(null)
  }

  const handleRemoveRow = (index: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index))
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!queue.length) {
      setErrors(['Add at least one row to submit.'])
      return
    }

    setIsSubmitting(true)
    setErrors([])
    setResult(null)

    try {
      const chunkSize = 500
      const chunks = chunkArray(queue, chunkSize)
      let totalInserted = 0
      const allRejected: ImportResult['rejected'] = []

      for (let i = 0; i < chunks.length; i += 1) {
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            mode: 'append',
            rows: chunks[i],
            rowOffset: i * chunkSize + 1,
          }),
        })

        const payload = await response.json()

        if (!response.ok) {
          setErrors([payload.error ?? 'Manual import failed.'])
          setIsSubmitting(false)
          return
        }

        totalInserted += payload.inserted ?? 0
        allRejected.push(...(payload.rejected ?? []))
      }

      setResult({ inserted: totalInserted, rejected: allRejected })
      setQueue([])
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Unexpected manual import error.',
      ])
    } finally {
      setIsSubmitting(false)
    }
  }

  const rowPreview = (row: Record<string, unknown>) => {
    if (config.title === 'Sell In') {
      return `${row.customer ?? ''} | ${row.product ?? ''} | ${row.date ?? ''} | ${row.qty_cans ?? ''}`
    }
    return `${row.company ?? ''} | ${row.product ?? ''} | ${row.month ?? ''} | ${row.units ?? ''}`
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <h2 className="text-lg font-semibold">{config.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{config.description}</p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {config.fields.map((field) => {
            const fieldOptions = optionsMap[field.key] ?? field.options ?? []
            const inputValue = formValues[field.key] ?? ''
            const listId =
              fieldOptions.length && field.type === 'text'
                ? `${config.title}-${field.key}-list`
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                : undefined
            const canAdd =
              field.allowAdd &&
              inputValue.trim().length > 0 &&
              !fieldOptions.some(
                (option) =>
                  option.toLowerCase() === inputValue.trim().toLowerCase()
              )

            return (
              <label
                key={field.key}
                className="space-y-1 text-xs text-slate-400"
              >
                <span className="flex items-center justify-between gap-2 uppercase tracking-[0.2em]">
                  <span>
                    {field.label}
                    {field.optional ? '' : ' *'}
                  </span>
                  {canAdd ? (
                    <button
                      type="button"
                      onClick={() => addOption(field.key, inputValue)}
                      className="text-[10px] font-semibold text-slate-400 hover:text-slate-200"
                    >
                      Add to list
                    </button>
                  ) : null}
                </span>
                <input
                  type={field.type}
                  value={inputValue}
                  onChange={(event) =>
                    handleChange(field.key, event.target.value)
                  }
                  placeholder={field.placeholder}
                  list={listId}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
                {listId ? (
                  <datalist id={listId}>
                    {fieldOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                ) : null}
              </label>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddRow}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-200 transition hover:border-slate-500"
          >
            Add row
          </button>
          <span className="text-xs text-slate-400">
            Rows queued: {queue.length}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Paste rows (CSV/TSV with headers)
          </p>
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={config.expectedHeaders.join(',')}
            rows={4}
            className="mt-2 w-full resize-none rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={handlePasteRows}
            className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-200 transition hover:border-slate-500"
          >
            Add pasted rows
          </button>
        </div>

        {queue.length ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Pending rows
            </p>
            <div className="mt-2 max-h-40 space-y-2 overflow-auto text-sm">
              {queue.map((row, index) => (
                <div
                  key={`${index}-${String(row[config.expectedHeaders[0]])}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{rowPreview(row)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    className="text-xs text-rose-200 transition hover:text-rose-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {errors.length ? (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !queue.length}
          className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Submitting...' : `Submit ${config.title} rows`}
        </button>
      </div>

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
    </div>
  )
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
        const effectiveMode = i === 0 ? values.mode : 'append'
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            mode: effectiveMode,
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
                  value="update"
                  className="accent-white"
                  {...register('mode')}
                />
                Update matching customers/companies
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
            <p className="text-xs text-slate-400">
              Append adds new rows only (duplicates are skipped). It will not
              update or correct existing rows. Update replaces only the
              customers/companies in your file within the detected date range.
              Replace deletes and re-loads the full brand/date range.
            </p>
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

      {mode !== 'append' ? (
        <p className="mt-4 text-xs text-slate-400">
          {mode === 'update'
            ? 'Update deletes existing rows for matching customers/companies within the detected brand/date range before inserting.'
            : 'Replace deletes existing rows for the detected brand(s) within the detected date range.'}
        </p>
      ) : null}
    </div>
  )
}

export default function ImportClient({
  workspaceId,
  manualOptions,
  defaultBrand,
  baseCurrency,
  supportedCurrencies,
}: {
  workspaceId: string
  manualOptions: ManualOptions
  defaultBrand?: string
  baseCurrency: string
  supportedCurrencies: string[]
}) {
  const sellInOptions = manualOptions?.sellIn ?? {
    customers: [],
    brands: [],
    products: [],
    countries: [],
  }
  const sellOutOptions = manualOptions?.sellOut ?? {
    companies: [],
    brands: [],
    products: [],
    platforms: [],
    regions: [],
  }

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

  const manualConfigs: ManualEntryConfig[] = [
    {
      title: 'Sell In',
      description: 'Manually add sell-in rows without uploading a file.',
      endpoint: '/api/import/sell-in',
      expectedHeaders: SELL_IN_HEADERS,
      requiredKeys: ['customer', 'brand', 'product', 'date', 'qty_cans'],
      fields: [
        {
          key: 'customer',
          label: 'Customer',
          type: 'text',
          options: sellInOptions.customers,
          allowAdd: true,
        },
        {
          key: 'country',
          label: 'Country',
          type: 'text',
          optional: true,
          options: sellInOptions.countries,
        },
        {
          key: 'brand',
          label: 'Brand',
          type: 'text',
          options: sellInOptions.brands,
          defaultValue: defaultBrand?.trim() || undefined,
        },
        {
          key: 'product',
          label: 'Product',
          type: 'text',
          options: sellInOptions.products,
          allowAdd: true,
        },
        { key: 'date', label: 'Date', type: 'date', placeholder: 'YYYY-MM-DD' },
        { key: 'qty_cans', label: 'Qty Cans', type: 'number' },
        {
          key: 'unit_price',
          label: 'Unit Price',
          type: 'number',
          optional: true,
        },
        { key: 'total', label: 'Total', type: 'number', optional: true },
        {
          key: 'promo_cans',
          label: 'Promo Cans',
          type: 'number',
          optional: true,
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'text',
          optional: true,
          options: supportedCurrencies,
          defaultValue: baseCurrency,
        },
      ],
    },
    {
      title: 'Sell Out',
      description: 'Manually add sell-out rows without uploading a file.',
      endpoint: '/api/import/sell-out',
      expectedHeaders: SELL_OUT_HEADERS,
      requiredKeys: ['company', 'brand', 'product', 'month', 'units'],
      fields: [
        {
          key: 'company',
          label: 'Company',
          type: 'text',
          options: sellOutOptions.companies,
          allowAdd: true,
        },
        {
          key: 'brand',
          label: 'Brand',
          type: 'text',
          options: sellOutOptions.brands,
          defaultValue: defaultBrand?.trim() || undefined,
        },
        {
          key: 'product',
          label: 'Product',
          type: 'text',
          options: sellOutOptions.products,
          allowAdd: true,
        },
        { key: 'month', label: 'Month', type: 'month', placeholder: 'YYYY-MM' },
        { key: 'units', label: 'Units', type: 'number' },
        {
          key: 'platform',
          label: 'Platform',
          type: 'text',
          optional: true,
          options: sellOutOptions.platforms,
        },
        {
          key: 'region',
          label: 'Region',
          type: 'text',
          optional: true,
          options: sellOutOptions.regions,
        },
        {
          key: 'currency',
          label: 'Currency',
          type: 'text',
          optional: true,
          options: supportedCurrencies,
          defaultValue: baseCurrency,
        },
      ],
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
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
          <strong className="text-slate-200">Modes:</strong> Append adds new
          rows only (duplicates skipped). Update replaces only the
          customers/companies in your file within the detected brand/date range.
          Replace deletes and reloads the full brand/date range.
        </div>
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

      <section className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Manual entry
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Add rows by hand</h2>
          <p className="mt-2 text-sm text-slate-300">
            Enter a few rows quickly or paste CSV/TSV text without uploading a
            file. Manual entry always appends.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {manualConfigs.map((config) => (
            <ManualEntrySection
              key={config.title}
              workspaceId={workspaceId}
              config={config}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
