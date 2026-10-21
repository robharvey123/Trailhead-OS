/**
 * Data Soap validation API client, TPS/CTPS check only.
 *
 * Lookup is `POST {DATASOAP_API_URL}{DATASOAP_LOOKUP_PATH}` with
 * `{ lookup, checks: ['Tps'] }`. Data Soap's v2 docs put the synchronous
 * lookup at `POST /v2` itself, so the path defaults to '' (the base URL);
 * override DATASOAP_LOOKUP_PATH if that ever moves.
 *
 * Every function here returns a value and never throws: a failed lookup leaves
 * the contact unscreened, which is the safe (uncallable) state.
 *
 * Env is read per call rather than at module load so tests can stub it.
 */

export type CtpsLookupResult =
  | { ok: true; phoneNormalised: string; tps: boolean; ctps: boolean; creditsUsed: number | null }
  | { ok: false; phoneNormalised: string; code: number | null; message: string; retryable: boolean }

const DEFAULT_BASE = 'https://api.datasoap.co.uk/v2'
const TIMEOUT_MS = 10_000

/** Data Soap error codes. -97 (temporary) and -90 (own rate limit) are worth retrying later. */
const ERROR_MESSAGES: Record<number, string> = {
  [-99]: 'token not recognised',
  [-98]: 'insufficient credit',
  [-97]: 'temporary error',
  [-96]: 'value not valid for lookup type',
  [-92]: 'unverified account over limit',
  [-90]: 'rate limit hit',
}
const RETRYABLE_CODES = new Set([-97, -90])

function base(): string {
  return (process.env.DATASOAP_API_URL || DEFAULT_BASE).replace(/\/+$/, '')
}

function lookupPath(): string {
  const path = (process.env.DATASOAP_LOOKUP_PATH ?? '').trim()
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

function token(): string | undefined {
  return process.env.DATASOAP_API_TOKEN || undefined
}

/** UK numbers to 44XXXXXXXXXX. Returns null when it cannot be a UK number. */
export function normaliseUkPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '')
  let n = digits.startsWith('+') ? digits.slice(1) : digits
  if (n.includes('+')) return null
  if (n.startsWith('0044')) n = n.slice(2)
  if (n.startsWith('0')) n = '44' + n.slice(1)
  if (n.startsWith('440')) n = '44' + n.slice(3) // "+44 (0)7700 ..."
  if (!n.startsWith('44')) return null
  if (n.length < 12 || n.length > 13) return null
  return n
}

export function isConfigured(): boolean {
  return Boolean(token())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${token() ?? ''}`, Accept: 'application/json' }
}

/** TPS credits left on the Data Soap account, or null when it can't be read. */
export async function getTpsCredits(): Promise<number | null> {
  if (!isConfigured()) return null
  try {
    const res = await fetchWithTimeout(`${base()}/balance`, { method: 'GET', headers: authHeaders() })
    if (!res.ok) return null
    const body: unknown = await res.json()
    if (!isRecord(body) || !isRecord(body.credits)) return null
    const tps = Number(body.credits.tps)
    return Number.isFinite(tps) ? tps : null
  } catch {
    return null
  }
}

function toCode(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isInteger(n) && n < 0 ? n : null
}

/**
 * Data Soap reports failures as a negative numeric code. The exact field name
 * isn't pinned down in the docs we could reach, so look in the likely places:
 * the top level, an `error` object, and the `tps` section itself.
 */
function findErrorCode(body: Record<string, unknown>): { code: number; message: string | null } | null {
  const scopes: Record<string, unknown>[] = [body]
  if (isRecord(body.error)) scopes.push(body.error)
  if (isRecord(body.tps)) scopes.push(body.tps)
  for (const scope of scopes) {
    for (const key of ['code', 'errorCode', 'error_code', 'error', 'status', 'statusCode', 'result']) {
      const code = toCode(scope[key])
      if (code !== null) {
        const msg = [scope.message, scope.errorMessage, scope.error_message, scope.description].find(
          (m): m is string => typeof m === 'string' && m.trim() !== '',
        )
        return { code, message: msg ?? null }
      }
    }
  }
  return null
}

function errorMessage(code: number | null, fallback: string): string {
  return code !== null && ERROR_MESSAGES[code] ? ERROR_MESSAGES[code] : fallback
}

/** One TPS/CTPS lookup. Never throws; every path returns a CtpsLookupResult. */
export async function lookupTps(phoneRaw: string): Promise<CtpsLookupResult> {
  const phoneNormalised = normaliseUkPhone(phoneRaw)
  if (!phoneNormalised) {
    return { ok: false, phoneNormalised: phoneRaw.trim(), code: -96, message: 'not a UK number', retryable: false }
  }
  const fail = (code: number | null, message: string, retryable: boolean): CtpsLookupResult => ({
    ok: false,
    phoneNormalised,
    code,
    message,
    retryable,
  })
  if (!isConfigured()) return fail(null, 'DATASOAP_API_TOKEN is not configured', false)

  let res: Response
  try {
    res = await fetchWithTimeout(`${base()}${lookupPath()}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: phoneNormalised, checks: ['Tps'] }),
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return fail(null, aborted ? `timed out after ${TIMEOUT_MS / 1000}s` : `network error: ${error instanceof Error ? error.message : String(error)}`, true)
  }

  const creditsHeader = res.headers.get('x-tps-credits-used')
  const parsedCredits = creditsHeader === null ? NaN : parseInt(creditsHeader, 10)
  const creditsUsed = Number.isNaN(parsedCredits) ? null : parsedCredits

  let body: unknown
  try {
    body = await res.json()
  } catch {
    // Non-JSON: a 5xx/429 is the provider having a bad moment; anything else is unexpected.
    const retryable = res.status >= 500 || res.status === 429
    return fail(null, `HTTP ${res.status}: response was not JSON`, retryable)
  }

  if (!isRecord(body)) return fail(null, `HTTP ${res.status}: unexpected response shape`, res.status >= 500)

  const tpsSection = body.tps
  if (isRecord(tpsSection) && typeof tpsSection.tps === 'boolean' && typeof tpsSection.ctps === 'boolean') {
    return { ok: true, phoneNormalised, tps: tpsSection.tps, ctps: tpsSection.ctps, creditsUsed }
  }

  const err = findErrorCode(body)
  if (err) {
    return fail(err.code, err.message ?? errorMessage(err.code, `Data Soap error ${err.code}`), RETRYABLE_CODES.has(err.code))
  }
  if (res.status >= 500 || res.status === 429) return fail(null, `HTTP ${res.status}`, true)
  return fail(null, `HTTP ${res.status}: no TPS result in response`, false)
}
