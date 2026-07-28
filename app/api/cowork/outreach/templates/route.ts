import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createTemplate, listTemplates } from '@/lib/cowork-outreach'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    return Response.json(await listTemplates())
  } catch (error) {
    return jsonError(error, 'Failed to load templates')
  }
}

// POST — create a template. Unknown merge tags are returned as a warning, not an error.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const { template, unknown_merge_tags } = await createTemplate(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'outreach_template',
      entityId: template.id,
      entityLabel: template.name,
      summary: `Created outreach template "${template.name}"${unknown_merge_tags.length ? ` (unknown tags: ${unknown_merge_tags.join(', ')})` : ''}`,
      payload: body,
    })
    return Response.json({ template, unknown_merge_tags }, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create template')
  }
}
