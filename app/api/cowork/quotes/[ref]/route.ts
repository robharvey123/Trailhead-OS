import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import {
  deleteCoworkQuote,
  formatQuote,
  getQuoteByRef,
  quoteDeletedSummary,
  quoteUpdatedSummary,
  updateCoworkQuote,
} from '@/lib/cowork-quotes'
import { recordCoworkWrite } from '@/lib/cowork-audit'

type Params = { params: Promise<{ ref: string }> }

// [ref] is a quote number (QT-0007, case-insensitive) or uuid.
export async function GET(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { ref } = await params
    return Response.json(formatQuote(await getQuoteByRef(decodeURIComponent(ref))))
  } catch (error) {
    return jsonError(error, 'Failed to load quote')
  }
}

// PATCH — see updateCoworkQuote. Changed fields are logged with their prior
// values in `before`, so the update is revertible from the activity log.
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { ref } = await params
    const body = await request.json().catch(() => ({}))
    const { quote, before, changed } = await updateCoworkQuote(decodeURIComponent(ref), body)
    if (changed.length > 0) {
      void recordCoworkWrite({
        action: 'update',
        entity: 'quote',
        entityId: quote.id,
        entityLabel: quote.quote_number,
        summary: quoteUpdatedSummary(quote, before, changed),
        before,
        payload: body,
      })
    }
    return Response.json(quote)
  } catch (error) {
    return jsonError(error, 'Failed to update quote')
  }
}

// DELETE — SOFT delete (deleted_at). 409 when accepted / converted / linked to an invoice.
export async function DELETE(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { ref } = await params
    const { quote } = await deleteCoworkQuote(decodeURIComponent(ref))
    void recordCoworkWrite({
      action: 'delete',
      entity: 'quote',
      entityId: quote.id,
      entityLabel: quote.quote_number,
      summary: quoteDeletedSummary(quote),
      payload: quote,
    })
    return Response.json({ deleted: true, soft: true, quote_number: quote.quote_number })
  } catch (error) {
    return jsonError(error, 'Failed to delete quote')
  }
}
