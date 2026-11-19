import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createCoworkQuote, listCoworkQuotes, quoteCreatedSummary } from '@/lib/cowork-quotes'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// GET /api/cowork/quotes?status=&account=&limit= — newest first, excludes soft-deleted.
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const quotes = await listCoworkQuotes({
      status: params.get('status'),
      accountName: params.get('account') ?? params.get('account_name'),
      limit: params.get('limit'),
    })
    return Response.json(quotes)
  } catch (error) {
    return jsonError(error, 'Failed to load quotes')
  }
}

// POST /api/cowork/quotes — create (draft or review). See createCoworkQuote.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { quote } = await createCoworkQuote(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'quote',
      entityId: quote.id,
      entityLabel: quote.quote_number,
      summary: quoteCreatedSummary(quote),
      payload: body,
    })
    return Response.json(quote, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create quote')
  }
}
