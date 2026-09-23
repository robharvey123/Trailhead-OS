/**
 * MCP auth guard — unit tests for both MCP entry points.
 *
 * Covers the secret-URL connector route (`/api/mcp/c/[token]`) and the existing
 * bearer route (`/api/mcp`), calling the exported route handlers directly with
 * Web `Request`s. No network, no database: every case uses `initialize` or
 * `tools/list`, which the MCP server answers from the in-process tool registry.
 * Supabase env vars are stubbed so importing the tool layer cannot reach a real
 * project even by accident.
 *
 * Run: `npm run test:mcp-connector`. Safe as a build gate — writes nothing.
 */

// Stubbed BEFORE the route imports run: lib/supabase/service.ts builds its client
// at module scope and throws on a missing URL. Deliberately unroutable.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-not-a-real-key'

// Repo imports are dynamic, below, because a static import would hoist above the
// env stubs and build the Supabase client before the URL exists.
import type { NextRequest } from 'next/server'

const GOOD_TOKEN = 'T'.repeat(56)
const WRONG_TOKEN_SAME_LENGTH = 'T'.repeat(55) + 'X'
const SHORT_TOKEN = 'T'.repeat(40) // under the 48-char floor
const BEARER = 'unit-test-cowork-key'

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}

/** A JSON-RPC POST at the connector path. The path carries the token verbatim. */
function rpcRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://app.trailheadholdings.uk${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mcp-connector-guard', version: '1.0.0' },
  },
}
const TOOLS_LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }

/** True when the body is a JSON-RPC success — i.e. the MCP handler ran. */
async function reachedHandler(response: Response): Promise<boolean> {
  if (response.status !== 200) return false
  const text = await response.text()
  try {
    return typeof (JSON.parse(text) as { result?: unknown }).result === 'object'
  } catch {
    return false
  }
}

async function main() {
  const { resetRateLimits } = await import('../lib/rate-limit')
  const { tools } = await import('../lib/mcp/tools')
  const connector = await import('../app/api/mcp/c/[token]/route')
  const bearer = await import('../app/api/mcp/route')

  // ── 1. Connector route: token handling ─────────────────────────────────────
  console.log('\n1. Secret-URL route — token handling')

  process.env.MCP_CONNECTOR_TOKEN = GOOD_TOKEN
  resetRateLimits()
  const good = await connector.POST(rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, INITIALIZE), {
    params: Promise.resolve({ token: GOOD_TOKEN }),
  })
  ok('correct token reaches the handler', await reachedHandler(good), `status ${good.status}`)

  resetRateLimits()
  const wrong = await connector.POST(
    rpcRequest(`/api/mcp/c/${WRONG_TOKEN_SAME_LENGTH}`, TOOLS_LIST),
    { params: Promise.resolve({ token: WRONG_TOKEN_SAME_LENGTH }) }
  )
  ok('wrong token (same length) → 404', wrong.status === 404, `status ${wrong.status}`)
  ok('wrong token never reaches the handler', !(await reachedHandler(wrong)))

  resetRateLimits()
  const wrongLength = await connector.POST(rpcRequest('/api/mcp/c/nope', TOOLS_LIST), {
    params: Promise.resolve({ token: 'nope' }),
  })
  ok('wrong token (different length) → 404', wrongLength.status === 404, `status ${wrongLength.status}`)

  // A token under 48 chars must fail closed even when the URL segment matches it
  // exactly — otherwise a careless short value in Vercel would be brute-forceable.
  process.env.MCP_CONNECTOR_TOKEN = SHORT_TOKEN
  resetRateLimits()
  const short = await connector.POST(rpcRequest(`/api/mcp/c/${SHORT_TOKEN}`, TOOLS_LIST), {
    params: Promise.resolve({ token: SHORT_TOKEN }),
  })
  ok('env token under 48 chars → 404 even on an exact match', short.status === 404, `status ${short.status}`)
  ok('short env token never reaches the handler', !(await reachedHandler(short)))

  delete process.env.MCP_CONNECTOR_TOKEN
  resetRateLimits()
  const unset = await connector.POST(rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, TOOLS_LIST), {
    params: Promise.resolve({ token: GOOD_TOKEN }),
  })
  ok('env token unset → 404', unset.status === 404, `status ${unset.status}`)
  ok('unset env token never reaches the handler', !(await reachedHandler(unset)))

  // ── 2. Connector route: other methods ──────────────────────────────────────
  console.log('\n2. Secret-URL route — GET / DELETE')

  process.env.MCP_CONNECTOR_TOKEN = GOOD_TOKEN
  resetRateLimits()
  const getGood = await connector.GET(rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, {}), {
    params: Promise.resolve({ token: GOOD_TOKEN }),
  })
  ok('GET with the correct token → 405 (stateless: no SSE stream)', getGood.status === 405, `status ${getGood.status}`)

  resetRateLimits()
  const getBad = await connector.GET(rpcRequest(`/api/mcp/c/${WRONG_TOKEN_SAME_LENGTH}`, {}), {
    params: Promise.resolve({ token: WRONG_TOKEN_SAME_LENGTH }),
  })
  ok('GET with a wrong token → 404, not 405', getBad.status === 404, `status ${getBad.status}`)

  resetRateLimits()
  const delBad = await connector.DELETE(rpcRequest(`/api/mcp/c/${WRONG_TOKEN_SAME_LENGTH}`, {}), {
    params: Promise.resolve({ token: WRONG_TOKEN_SAME_LENGTH }),
  })
  ok('DELETE with a wrong token → 404, not 405', delBad.status === 404, `status ${delBad.status}`)

  // ── 3. Bearer route unchanged ──────────────────────────────────────────────
  console.log('\n3. Bearer route (/api/mcp) — unchanged behaviour')

  process.env.COWORK_API_KEY = BEARER
  const bearerGood = await bearer.POST(
    rpcRequest('/api/mcp', INITIALIZE, { authorization: `Bearer ${BEARER}` })
  )
  ok('valid bearer reaches the handler', await reachedHandler(bearerGood), `status ${bearerGood.status}`)

  const bearerBad = await bearer.POST(
    rpcRequest('/api/mcp', TOOLS_LIST, { authorization: 'Bearer wrong-key' })
  )
  ok('bad bearer → 401', bearerBad.status === 401, `status ${bearerBad.status}`)
  ok('bad bearer never reaches the handler', !(await reachedHandler(bearerBad)))

  const bearerNone = await bearer.POST(rpcRequest('/api/mcp', TOOLS_LIST))
  ok('missing bearer → 401', bearerNone.status === 401, `status ${bearerNone.status}`)

  // The connector token must not be accepted as a bearer, or vice versa.
  const crossed = await bearer.POST(
    rpcRequest('/api/mcp', TOOLS_LIST, { authorization: `Bearer ${GOOD_TOKEN}` })
  )
  ok('connector token is not a valid bearer', crossed.status === 401, `status ${crossed.status}`)

  // ── 4. Tool surface is identical on both routes ────────────────────────────
  console.log('\n4. Tool surface')

  resetRateLimits()
  const listRes = await connector.POST(rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, TOOLS_LIST), {
    params: Promise.resolve({ token: GOOD_TOKEN }),
  })
  const listed = (JSON.parse(await listRes.text()) as {
    result?: { tools?: { name: string; description?: string; inputSchema?: unknown }[] }
  }).result?.tools ?? []
  const names = listed.map((tool) => tool.name)
  ok('tools/list over the secret URL returns every tool', names.length === tools.length, `${names.length} of ${tools.length}`)
  for (const expected of [
    'create_engagement_document_upload',
    'confirm_engagement_document_upload',
    'update_time_entry',
    'create_engagement',
    'update_engagement',
  ]) {
    ok(`tools/list includes ${expected}`, names.includes(expected))
  }
  ok('every tool has a description', listed.every((tool) => Boolean(tool.description?.trim())))
  ok('every tool has an input schema', listed.every((tool) => Boolean(tool.inputSchema)))

  const byName = new Map(listed.map((tool) => [tool.name, tool]))
  const createSchema = JSON.stringify(byName.get('create_engagement')?.inputSchema ?? {})
  ok('create_engagement requires name + start_date',
    /"required":\[[^\]]*"name"[^\]]*"start_date"/.test(createSchema) ||
      (/"name"/.test(createSchema) && /"start_date"/.test(createSchema)))
  for (const value of ['client_consulting', 'internal_ops', 'Draft', 'Terminated']) {
    ok(`create_engagement advertises "${value}"`, createSchema.includes(`"${value}"`))
  }
  const updateSchema = JSON.stringify(byName.get('update_engagement')?.inputSchema ?? {})
  ok('update_engagement takes an engagement ref', /"engagement"/.test(updateSchema))
  for (const value of ['Active', 'Paused', 'Completed']) {
    ok(`update_engagement advertises "${value}"`, updateSchema.includes(`"${value}"`))
  }
  const createDescription = tools.find((tool) => tool.name === 'create_engagement')?.description ?? ''
  ok('create_engagement warns that internal types are non-billable', /non-billable/i.test(createDescription))

  // Task 6: engagement arguments must advertise the code form, or Claude sends a
  // uuid it does not have.
  const codeExample = tools.filter((tool) => /QOLA-UKEU-26|code or uuid|code like/i.test(tool.description))
  ok('engagement-referencing tools mention the code form', codeExample.length >= 16, `${codeExample.length} tools`)
  const logTimeDescription = tools.find((tool) => tool.name === 'log_time')?.description ?? ''
  ok('log_time warns about the 0 rate snapshot', /snapshots its rate at 0|rate at 0/.test(logTimeDescription))

  // ── 5. Rate limiting ───────────────────────────────────────────────────────
  console.log('\n5. Per-IP rate limit (120/min)')

  resetRateLimits()
  const ip = { 'x-forwarded-for': '203.0.113.7' }
  let lastStatus = 0
  for (let i = 0; i < 120; i++) {
    const res = await connector.POST(
      rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, INITIALIZE, ip),
      { params: Promise.resolve({ token: GOOD_TOKEN }) }
    )
    lastStatus = res.status
    await res.text()
  }
  ok('request 120 still succeeds', lastStatus === 200, `status ${lastStatus}`)

  const over = await connector.POST(rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, INITIALIZE, ip), {
    params: Promise.resolve({ token: GOOD_TOKEN }),
  })
  ok('request 121 → 429', over.status === 429, `status ${over.status}`)
  ok('429 carries retry-after', Boolean(over.headers.get('retry-after')))

  const otherIp = await connector.POST(
    rpcRequest(`/api/mcp/c/${GOOD_TOKEN}`, INITIALIZE, { 'x-forwarded-for': '198.51.100.4' }),
    { params: Promise.resolve({ token: GOOD_TOKEN }) }
  )
  ok('a different IP is not limited', otherIp.status === 200, `status ${otherIp.status}`)

  console.log(`\n${fail === 0 ? '✓ MCP CONNECTOR GUARD PASSED' : `✗ ${fail} FAILURE(S)`}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
