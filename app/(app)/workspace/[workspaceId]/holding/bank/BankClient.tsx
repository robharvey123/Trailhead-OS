'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { BankTransaction } from '@/lib/holding/types'

type SuggestedMatch = {
  type: 'invoice' | 'expense' | 'stripe'
  id: string
  label: string
  amount: number
  date: string
  confidence: 'high' | 'medium' | 'low'
}

const fmtCurrency = (v: number) =>
  `£${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BankClient({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<'transactions' | 'import' | 'reconcile'>('transactions')

  // Transactions state
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loadingTxs, setLoadingTxs] = useState(true)
  const [filterDir, setFilterDir] = useState<string>('all')
  const [filterReconciled, setFilterReconciled] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null)

  // Reconcile state
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedMatch[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const loadTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      if (filterDir !== 'all') params.set('direction', filterDir)
      if (filterReconciled !== 'all') params.set('reconciled', filterReconciled)
      if (search) params.set('search', search)
      const res = await apiFetch<{ transactions: BankTransaction[] }>(`/api/holding/bank/transactions?${params}`)
      setTransactions(res.transactions)
    } catch { /* silent */ } finally { setLoadingTxs(false) }
  }, [workspaceId, filterDir, filterReconciled, search])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  // === CSV Import ===
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) { toast.error('CSV file is empty or has no data rows'); return }
      const headers = lines[0].split(',').map((h) => h.trim())
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })
      setCsvRows(rows)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (csvRows.length === 0) return
    setImporting(true)
    try {
      const res = await apiFetch<{ imported: number; skipped: number; errors: number }>(
        '/api/holding/bank/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, rows: csvRows }),
        }
      )
      setImportResult(res)
      toast.success(`Imported ${res.imported} transaction${res.imported !== 1 ? 's' : ''}`)
      setCsvRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadTransactions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally { setImporting(false) }
  }

  // === Reconciliation ===
  const openReconcile = async (tx: BankTransaction) => {
    setSelectedTx(tx)
    setTab('reconcile')
    setLoadingSuggestions(true)
    try {
      const res = await apiFetch<{ suggestions: SuggestedMatch[] }>(
        `/api/holding/bank/reconcile?workspace_id=${workspaceId}&transaction_id=${tx.id}`
      )
      setSuggestions(res.suggestions)
    } catch { setSuggestions([]) } finally { setLoadingSuggestions(false) }
  }

  const handleMatch = async (tx: BankTransaction, matchType: string, matchId: string) => {
    try {
      await apiFetch('/api/holding/bank/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, transaction_id: tx.id, match_type: matchType, match_id: matchId }),
      })
      toast.success('Transaction reconciled')
      setSelectedTx(null)
      loadTransactions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Match failed')
    }
  }

  const handleUnmatch = async (tx: BankTransaction) => {
    try {
      await apiFetch(`/api/holding/bank/reconcile?workspace_id=${workspaceId}&transaction_id=${tx.id}`, { method: 'DELETE' })
      toast.success('Match removed')
      loadTransactions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unmatch failed')
    }
  }

  const unreconciledCount = transactions.filter((t) => !t.reconciled).length
  const totalIn = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalOut = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const CONFIDENCE_COLORS = { high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-slate-400' }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
        <h1 className="mt-1 text-2xl font-semibold">Bank Account</h1>
        <p className="mt-1 text-sm text-slate-400">
          In: {fmtCurrency(totalIn)} &middot; Out: {fmtCurrency(totalOut)} &middot; {unreconciledCount} unreconciled
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {(['transactions', 'import', 'reconcile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'transactions' ? 'Transactions' : t === 'import' ? 'Import CSV' : 'Reconcile'}
          </button>
        ))}
      </div>

      {/* === Transactions Tab === */}
      {tab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterDir} onChange={(e) => setFilterDir(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
              <option value="all">All directions</option>
              <option value="in">Money In</option>
              <option value="out">Money Out</option>
            </select>
            <select value={filterReconciled} onChange={(e) => setFilterReconciled(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
              <option value="all">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Unreconciled</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search counterparty, reference…"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 w-64"
            />
          </div>

          {loadingTxs ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Counterparty</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No transactions. Import a CSV to get started.</td></tr>
                  ) : transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-400">{tx.date}</td>
                      <td className="px-4 py-3 font-medium">{tx.counterparty || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{tx.reference || tx.description || '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.amount >= 0 ? '+' : '-'}{fmtCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{tx.balance_after !== null ? fmtCurrency(tx.balance_after) : '—'}</td>
                      <td className="px-4 py-3">
                        {tx.reconciled ? (
                          <span className="text-xs text-emerald-400">Reconciled</span>
                        ) : (
                          <span className="text-xs text-amber-400">Unreconciled</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {tx.reconciled ? (
                            <button onClick={() => handleUnmatch(tx)} className="text-xs text-slate-400 hover:text-white">Unmatch</button>
                          ) : (
                            <button onClick={() => openReconcile(tx)} className="text-xs text-blue-400 hover:text-blue-300">Reconcile</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === Import Tab === */}
      {tab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Import Tide CSV</h2>
            <p className="mt-1 text-sm text-slate-400">
              Export transactions from your Tide account and upload the CSV file. Duplicate transactions are automatically skipped.
            </p>
            <div className="mt-4 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
              />

              {csvRows.length > 0 && (
                <>
                  <p className="text-sm text-slate-300">{csvRows.length} rows ready to import</p>
                  <div className="max-h-64 overflow-auto rounded-xl border border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-slate-400">
                          {Object.keys(csvRows[0]).slice(0, 6).map((h) => (
                            <th key={h} className="px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-b border-slate-800/50">
                            {Object.keys(csvRows[0]).slice(0, 6).map((h) => (
                              <td key={h} className="px-3 py-2 text-slate-300">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                        {csvRows.length > 10 && (
                          <tr><td colSpan={6} className="px-3 py-2 text-center text-slate-500">… and {csvRows.length - 10} more rows</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : `Import ${csvRows.length} Transactions`}
                  </button>
                </>
              )}

              {importResult && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
                  <p className="text-emerald-400">Imported: {importResult.imported}</p>
                  {importResult.skipped > 0 && <p className="text-slate-400">Skipped (duplicates): {importResult.skipped}</p>}
                  {importResult.errors > 0 && <p className="text-rose-400">Errors: {importResult.errors}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === Reconcile Tab === */}
      {tab === 'reconcile' && (
        <div className="space-y-6">
          {selectedTx ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
                <h2 className="text-lg font-semibold">Reconcile Transaction</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-400">Date</p>
                    <p className="mt-1 font-medium">{selectedTx.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Counterparty</p>
                    <p className="mt-1 font-medium">{selectedTx.counterparty || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className={`mt-1 font-medium ${selectedTx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedTx.amount >= 0 ? '+' : '-'}{fmtCurrency(selectedTx.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Reference</p>
                    <p className="mt-1 font-medium text-slate-300">{selectedTx.reference || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
                <h3 className="font-semibold">Suggested Matches</h3>
                {loadingSuggestions ? (
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No matching invoices, expenses, or Stripe payments found.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {suggestions.map((s) => (
                      <div key={`${s.type}-${s.id}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase text-slate-500">{s.type}</span>
                            <span className={`text-xs ${CONFIDENCE_COLORS[s.confidence]}`}>{s.confidence} confidence</span>
                          </div>
                          <p className="mt-1 font-medium">{s.label}</p>
                          <p className="text-sm text-slate-400">{s.date} &middot; {fmtCurrency(s.amount)}</p>
                        </div>
                        <button
                          onClick={() => handleMatch(selectedTx, s.type, s.id)}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold uppercase text-white hover:bg-emerald-500"
                        >
                          Match
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setSelectedTx(null); setTab('transactions') }}
                  className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white"
                >
                  Back to Transactions
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
              <p className="text-slate-400">Select an unreconciled transaction from the Transactions tab to begin reconciliation.</p>
              <button
                onClick={() => setTab('transactions')}
                className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white"
              >
                View Transactions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
