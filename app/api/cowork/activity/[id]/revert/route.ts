import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { revertCoworkActivity } from '@/lib/cowork-audit'

// POST — revert a reversible Cowork write (invoice status change, time entry
// create, milestone gate). Unsupported entities return 400.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const result = await revertCoworkActivity(id)
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to revert')
  }
}
