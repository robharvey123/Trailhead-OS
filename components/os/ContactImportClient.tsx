'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'

/* ─── Column mapping config ─── */
const CONTACT_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'channel', label: 'Channel' },
  { key: 'website', label: 'Website' },
  { key: 'workstream', label: 'Workstream (slug)' },
  { key: 'address_line1', label: 'Address line 1' },
  { key: 'address_line2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'tags', label: 'Tags (comma-separated)' },
] as const

type FieldKey = (typeof CONTACT_FIELDS)[number]['key']

/** Best-effort auto-map from CSV header → contact field */
function autoMap(csvHeader: string): FieldKey | '' {
  const h = csvHeader.toLowerCase().replace(/[^a-z0-9]/g, '')
  const map: Record<string, FieldKey> = {
    name: 'name',
    fullname: 'name',
    contactname: 'name',
    company: 'company',
    companyname: 'company',
    organisation: 'company',
    organization: 'company',
    email: 'email',
    emailaddress: 'email',
    phone: 'phone',
    telephone: 'phone',
    phonenumber: 'phone',
    mobile: 'phone',
    role: 'role',
    jobtitle: 'role',
    title: 'role',
    position: 'role',
    addressline1: 'address_line1',
    address1: 'address_line1',
    address: 'address_line1',
    addressline2: 'address_line2',
    address2: 'address_line2',
    city: 'city',
    town: 'city',
    postcode: 'postcode',
    zipcode: 'postcode',
    zip: 'postcode',
    postalcode: 'postcode',
    country: 'country',
    status: 'status',
    notes: 'notes',
    tags: 'tags',
    channel: 'channel',
    website: 'website',
    site: 'website',
    url: 'website',
    workstream: 'workstream',
  }
  return map[h] ?? ''
}

type ImportResult = {
  inserted: number
  rejected: Array<{ row: number; reason: string }>
}

type WorkstreamOption = { id: string; slug: string; label: string }
type ProjectOption = { id: string; name: string; workstream_id: string }

export default function ContactImportClient({
  workstreams = [],
  projects = [],
}: {
  workstreams?: WorkstreamOption[]
  projects?: ProjectOption[]
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, FieldKey | ''>>({})
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'result'>('upload')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [globalWorkstreamId, setGlobalWorkstreamId] = useState('')
  const [globalProjectId, setGlobalProjectId] = useState('')

  /* ─── Parse file ─── */
  const handleFile = useCallback((file: File) => {
    setError('')
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      })

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        setError('Failed to parse file. Ensure it is a valid CSV.')
        return
      }

      const headers = parsed.meta.fields ?? []
      if (headers.length === 0) {
        setError('No columns found in file.')
        return
      }

      setCsvHeaders(headers)
      setCsvRows(parsed.data)

      // Auto-map headers
      const initialMapping: Record<string, FieldKey | ''> = {}
      const used = new Set<FieldKey>()
      for (const h of headers) {
        const mapped = autoMap(h)
        if (mapped && !used.has(mapped)) {
          initialMapping[h] = mapped
          used.add(mapped)
        } else {
          initialMapping[h] = ''
        }
      }
      setMapping(initialMapping)
      setStep('map')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  /* ─── Build mapped rows for preview ─── */
  const mappedRows = useMemo(() => {
    return csvRows.map((row) => {
      const mapped: Record<string, string> = {}
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field) {
          mapped[field] = row[csvCol] ?? ''
        }
      }
      return mapped
    })
  }, [csvRows, mapping])

  const nameIsMapped = Object.values(mapping).includes('name')
  const validRowCount = mappedRows.filter((r) => r.name?.trim()).length

  /* ─── Submit import ─── */
  const handleImport = async () => {
    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: mappedRows,
          workstream_id: globalWorkstreamId || null,
          project_id: globalProjectId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
        setImporting(false)
        return
      }

      setResult(data)
      setStep('result')
    } catch {
      setError('Network error during import')
    } finally {
      setImporting(false)
    }
  }

  /* ─── Reset ─── */
  const handleReset = () => {
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setFileName('')
    setStep('upload')
    setResult(null)
    setError('')
    setGlobalWorkstreamId('')
    setGlobalProjectId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">Clients</p>
          <h1 className="os-page-title mt-2">Import contacts</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Upload a CSV file to import contacts in bulk.
          </p>
        </div>
        <Link
          href="/crm/contacts"
          className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)]"
        >
          Back to contacts
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] px-4 py-3 text-sm text-[color:var(--red-strong)]">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="os-card flex flex-col items-center gap-4 border-2 border-dashed px-8 py-16 text-center transition hover:border-[color:var(--accent)]"
        >
          <div className="rounded-full bg-[var(--accent-dim)] p-4">
            <svg className="h-8 w-8 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-[color:var(--text)]">Drag &amp; drop a CSV file here</p>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">or click to browse</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Choose file
          </button>
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === 'map' && (
        <div className="space-y-6">
          <div className="os-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--text)]">Map columns</h2>
                <p className="mt-1 text-sm text-[color:var(--text-2)]">
                  {fileName} — {csvRows.length} row{csvRows.length !== 1 && 's'} found
                </p>
              </div>
              <button
                onClick={handleReset}
                className="rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)] hover:text-[color:var(--text)]"
              >
                Choose different file
              </button>
            </div>

            <div className="space-y-3">
              {csvHeaders.map((header) => (
                <div
                  key={header}
                  className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]"
                >
                  <span className="truncate text-sm text-[color:var(--text)]">{header}</span>
                  <span className="hidden text-[color:var(--text-2)] md:block">→</span>
                  <select
                    value={mapping[header] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [header]: e.target.value as FieldKey | '',
                      }))
                    }
                    className="os-select"
                  >
                    <option value="">— Skip —</option>
                    {CONTACT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {'required' in f && f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!nameIsMapped && (
              <p className="mt-4 text-sm text-[color:var(--amber-strong)]">
                You must map at least one column to &quot;Name&quot; to continue.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)]"
            >
              Cancel
            </button>
            <button
              disabled={!nameIsMapped}
              onClick={() => setStep('preview')}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              Preview import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          <div className="os-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[color:var(--text)]">Preview</h2>
              <p className="mt-1 text-sm text-[color:var(--text-2)]">
                {validRowCount} of {mappedRows.length} rows have a name and will be imported.
                {mappedRows.length - validRowCount > 0 && (
                  <span className="text-[color:var(--amber-strong)]">
                    {' '}{mappedRows.length - validRowCount} row{mappedRows.length - validRowCount !== 1 && 's'} will be skipped (no name).
                  </span>
                )}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
                  <tr>
                    <th className="pb-3 pr-4">#</th>
                    {CONTACT_FIELDS.filter((f) =>
                      Object.values(mapping).includes(f.key)
                    ).map((f) => (
                      <th key={f.key} className="pb-3 pr-4">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 20).map((row, i) => {
                    const hasName = !!row.name?.trim()
                    return (
                      <tr
                        key={i}
                        className={`border-t border-[color:var(--border)] ${!hasName ? 'opacity-40' : ''}`}
                      >
                        <td className="py-3 pr-4 text-[color:var(--text-2)]">{i + 1}</td>
                        {CONTACT_FIELDS.filter((f) =>
                          Object.values(mapping).includes(f.key)
                        ).map((f) => (
                          <td key={f.key} className="py-3 pr-4 text-[color:var(--text)]">
                            {row[f.key] || <span className="text-[color:var(--text-3)]">—</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {mappedRows.length > 20 && (
                <p className="mt-3 text-sm text-[color:var(--text-2)]">
                  Showing first 20 of {mappedRows.length} rows.
                </p>
              )}
            </div>
          </div>

          {/* Assign workstream & project */}
          {(workstreams.length > 0 || projects.length > 0) && (
            <div className="os-card p-6">
              <h3 className="mb-1 text-sm font-semibold text-[color:var(--text)]">Assign to workstream &amp; project</h3>
              <p className="mb-4 text-xs text-[color:var(--text-2)]">
                Applied to all imported contacts (unless the CSV has a workstream column mapped).
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {workstreams.length > 0 && (
                  <label className="space-y-2">
                    <span className="text-sm text-[color:var(--text-2)]">Workstream</span>
                    <select
                      value={globalWorkstreamId}
                      onChange={(e) => setGlobalWorkstreamId(e.target.value)}
                      className="os-select w-full"
                    >
                      <option value="">— None (use CSV value) —</option>
                      {workstreams.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {projects.length > 0 && (
                  <label className="space-y-2">
                    <span className="text-sm text-[color:var(--text-2)]">Project</span>
                    <select
                      value={globalProjectId}
                      onChange={(e) => setGlobalProjectId(e.target.value)}
                      className="os-select w-full"
                    >
                      <option value="">— None —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep('map')}
              className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)]"
            >
              Back to mapping
            </button>
            <button
              disabled={importing || validRowCount === 0}
              onClick={handleImport}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              {importing ? 'Importing…' : `Import ${validRowCount} contact${validRowCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className="os-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[var(--emerald-dim)] p-3">
                <svg className="h-6 w-6 text-[color:var(--emerald-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--text)]">Import complete</h2>
                <p className="mt-1 text-sm text-[color:var(--text-2)]">
                  {result.inserted} contact{result.inserted !== 1 && 's'} imported successfully.
                  {result.rejected.length > 0 && (
                    <span className="text-[color:var(--amber-strong)]">
                      {' '}{result.rejected.length} row{result.rejected.length !== 1 && 's'} rejected.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {result.rejected.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium text-[color:var(--text)]">Rejected rows</h3>
                <div className="space-y-1">
                  {result.rejected.map((r) => (
                    <p key={r.row} className="text-sm text-[color:var(--text-2)]">
                      Row {r.row}: {r.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)]"
            >
              Import more
            </button>
            <Link
              href="/crm/contacts"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              View contacts
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
