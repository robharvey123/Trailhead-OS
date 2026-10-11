import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getCoworkSettings, updateCoworkSettings } from '@/lib/cowork-settings'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    return Response.json(await getCoworkSettings())
  } catch (error) {
    return jsonError(error, 'Failed to load settings')
  }
}

// PATCH — company fields only (SETTINGS_PATCH_FIELDS in lib/cowork-settings.ts).
// Bank/payment details are a 400 naming the refused keys; they stay UI-only.
export async function PATCH(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    return Response.json(await updateCoworkSettings(body))
  } catch (error) {
    return jsonError(error, 'Failed to update settings')
  }
}
