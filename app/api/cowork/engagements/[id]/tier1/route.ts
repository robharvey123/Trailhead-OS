import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, optionalString } from '@/lib/cowork-api'
import { addTier1, getEngagementRow, listTier1, removeTier1 } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    return Response.json(await listTier1(id))
  } catch (error) {
    return jsonError(error, 'Failed to load tier-1 accounts')
  }
}

// POST — attach a target account. Accepts account_id or account_name; with
// create_if_missing:true a new account is created from account_name.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const engagement = await getEngagementRow(id)
    const tier1 = await addTier1(id, body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'tier1_account',
      engagementId: engagement.id,
      summary: `Attached a Tier 1 target account to ${engagement.name} (${tier1.length} tracked)`,
      payload: body,
    })
    return Response.json(tier1, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to add tier-1 account')
  }
}

// DELETE — detach a target account. account_id via query string or JSON body.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const fromQuery = request.nextUrl.searchParams.get('account_id')
    const body = fromQuery ? {} : await request.json().catch(() => ({}))
    const accountId = optionalString(fromQuery) ?? optionalString(body.account_id)
    if (!accountId) return Response.json({ error: 'account_id is required' }, { status: 400 })
    const engagement = await getEngagementRow(id)
    await removeTier1(id, accountId)
    void recordCoworkWrite({
      action: 'delete',
      entity: 'tier1_account',
      entityId: accountId,
      engagementId: engagement.id,
      summary: `Detached a Tier 1 target account from ${engagement.name}`,
    })
    return Response.json(await listTier1(id))
  } catch (error) {
    return jsonError(error, 'Failed to remove tier-1 account')
  }
}
