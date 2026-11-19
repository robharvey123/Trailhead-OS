import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { publishCoworkQuote } from '@/lib/cowork-quotes'

type Params = { params: Promise<{ ref: string }> }

// POST — REST twin of the publish_quote MCP tool. Body { regenerate?: true }.
// 200 with { published: false, failures } when the completeness check fails.
export async function POST(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { ref } = await params
    const body = (await request.json().catch(() => ({}))) as { regenerate?: unknown }
    const regenerate = body.regenerate === true
    const result = await publishCoworkQuote(decodeURIComponent(ref), regenerate)
    if (result.published && !result.already_published) {
      void recordCoworkWrite({
        action: 'update',
        entity: 'quote',
        entityLabel: result.quote_number,
        summary: `${regenerate ? 'Regenerated the client page link for' : 'Published'} quote ${result.quote_number}`,
        payload: { regenerate },
      })
    }
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to publish quote')
  }
}
