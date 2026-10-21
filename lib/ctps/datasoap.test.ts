import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTpsCredits, isConfigured, lookupTps, normaliseUkPhone } from './datasoap'

describe('normaliseUkPhone', () => {
  it.each([
    ['01245 123456', '441245123456'],
    ['+44 7700 900123', '447700900123'],
    ['0044 7700 900123', '447700900123'],
    ['07700900123', '447700900123'],
    ['+44 (0)7700 900123', '447700900123'],
    ['447700900123', '447700900123'],
  ])('%s -> %s', (raw, expected) => {
    expect(normaliseUkPhone(raw)).toBe(expected)
  })

  it.each(['12345', '+1 212 555 0100', '', '+44 77', '07700 900123 +44'])('%s -> null', (raw) => {
    expect(normaliseUkPhone(raw)).toBeNull()
  })
})

function jsonResponse(body: unknown, init: { status?: number; credits?: string } = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (init.credits !== undefined) headers.set('X-TPS-Credits-Used', init.credits)
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers })
}

describe('lookupTps', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubEnv('DATASOAP_API_TOKEN', 'test-token')
    vi.stubEnv('DATASOAP_API_URL', 'https://api.example.test/v2')
    vi.stubEnv('DATASOAP_LOOKUP_PATH', '')
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('posts the normalised number with a bearer token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tps: { tps: false, ctps: false } }, { credits: '1' }))
    await lookupTps('07700 900123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.test/v2')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
    expect(JSON.parse(String(init?.body))).toEqual({ lookup: '447700900123', checks: ['Tps'] })
  })

  it('honours DATASOAP_LOOKUP_PATH', async () => {
    vi.stubEnv('DATASOAP_LOOKUP_PATH', 'validate')
    fetchMock.mockResolvedValueOnce(jsonResponse({ tps: { tps: false, ctps: false } }))
    await lookupTps('07700900123')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/v2/validate')
  })

  it('clear number', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tps: { tps: false, ctps: false } }, { credits: '1' }))
    await expect(lookupTps('07700900123')).resolves.toEqual({
      ok: true, phoneNormalised: '447700900123', tps: false, ctps: false, creditsUsed: 1,
    })
  })

  it('CTPS registered', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tps: { tps: false, ctps: true } }, { credits: '1' }))
    const r = await lookupTps('01245 123456')
    expect(r).toMatchObject({ ok: true, tps: false, ctps: true })
  })

  it('TPS registered, no credits header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tps: { tps: true, ctps: false } }))
    const r = await lookupTps('07700900123')
    expect(r).toMatchObject({ ok: true, tps: true, ctps: false, creditsUsed: null })
  })

  it('-98 insufficient credit is not retryable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: -98 }, { status: 402 }))
    const r = await lookupTps('07700900123')
    expect(r).toEqual({ ok: false, phoneNormalised: '447700900123', code: -98, message: 'insufficient credit', retryable: false })
  })

  it('-97 temporary error is retryable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: '-97', message: 'Try again' } }))
    const r = await lookupTps('07700900123')
    expect(r).toMatchObject({ ok: false, code: -97, message: 'Try again', retryable: true })
  })

  it('non-JSON 500 is retryable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 500 }))
    const r = await lookupTps('07700900123')
    expect(r).toMatchObject({ ok: false, code: null, retryable: true })
  })

  it('times out after 10s and is retryable', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const pending = lookupTps('07700900123')
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(pending).resolves.toMatchObject({ ok: false, code: null, retryable: true, message: 'timed out after 10s' })
  })

  it('network failure never throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(lookupTps('07700900123')).resolves.toMatchObject({ ok: false, retryable: true })
  })

  it('rejects a non-UK number without calling the API', async () => {
    const r = await lookupTps('+1 212 555 0100')
    expect(r).toMatchObject({ ok: false, code: -96, retryable: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to call without a token', async () => {
    vi.stubEnv('DATASOAP_API_TOKEN', '')
    expect(isConfigured()).toBe(false)
    const r = await lookupTps('07700900123')
    expect(r).toMatchObject({ ok: false, retryable: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getTpsCredits', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubEnv('DATASOAP_API_TOKEN', 'test-token')
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reads credits.tps', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ credits: { tps: 412, hlr: 0 } }))
    await expect(getTpsCredits()).resolves.toBe(412)
  })

  it('null on failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }))
    await expect(getTpsCredits()).resolves.toBeNull()
  })
})
