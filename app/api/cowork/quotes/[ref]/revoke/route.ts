import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { revokeCoworkQuoteLink } from '@/lib/cowork-quotes'

type Params = { params: Promise<{ ref: string }> }

// POST — REST twin of the revoke_quote_link MCP tool.
export async function POST(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { ref } = await params
    const result = await revokeCoworkQuoteLink(decodeURIComponent(ref))
    if (result.revoked) {
      void recordCoworkWrite({
        action: 'update',
        entity: 'quote',
        entityLabel: result.quote_number,
        summary: `Revoked the client page link for quote ${result.quote_number}`,
        payload: {},
      })
    }
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to revoke link')
  }
}
