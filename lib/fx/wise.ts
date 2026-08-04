/**
 * Wise (TransferWise) mid-market rate lookup for invoice FX.
 *
 * Uses the read-only /v1/rates endpoint. Needs WISE_API_TOKEN (a read-only API
 * token from Wise → Settings → API tokens). Optional WISE_API_BASE overrides the
 * host (default production; use https://api.sandbox.transferwise.tech to test).
 *
 * Returns the quoted pair (1 GBP = N target), which is exactly what the invoice
 * stores as fx_rate_quote.
 */

export class FxError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

const WISE_BASE = process.env.WISE_API_BASE || 'https://api.wise.com'

export type FxRate = { rate: number; date: string; source: string }

export async function fetchWiseRate(from: string, to: string): Promise<FxRate> {
  const token = process.env.WISE_API_TOKEN
  if (!token) {
    throw new FxError('Wise rate lookup is not configured yet — add WISE_API_TOKEN.', 503)
  }

  const url = `${WISE_BASE}/v1/rates?source=${encodeURIComponent(from)}&target=${encodeURIComponent(to)}`
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  } catch {
    throw new FxError('Could not reach Wise to fetch the rate.', 502)
  }
  if (res.status === 401 || res.status === 403) {
    throw new FxError('Wise rejected the API token (check WISE_API_TOKEN).', 502)
  }
  if (!res.ok) {
    throw new FxError(`Wise rate lookup failed (${res.status}).`, 502)
  }

  const data = (await res.json().catch(() => null)) as Array<{ rate?: number; time?: string }> | { rate?: number; time?: string } | null
  const row = Array.isArray(data) ? data[0] : data
  const rate = Number(row?.rate)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new FxError('Wise returned no usable rate for that pair.', 502)
  }
  const date = typeof row?.time === 'string' && row.time.length >= 10 ? row.time.slice(0, 10) : new Date().toISOString().slice(0, 10)
  return { rate, date, source: 'Wise' }
}
