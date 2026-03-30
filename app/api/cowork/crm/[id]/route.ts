import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  CONTACT_SELECT,
  TASK_SELECT,
  formatContact,
  formatTask,
  getContactById,
  getWorkstreamBySlug,
  jsonError,
  optionalString,
  parseContactStatus,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const contact = await getContactById(id)

    const [tasksResult, emailsResult] = await Promise.all([
      supabaseService
        .from('tasks')
        .select(TASK_SELECT)
        .eq('contact_id', id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseService
        .from('email_logs')
        .select('id, subject, from_address, to_addresses, snippet, direction, sent_at, received_at, created_at')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (tasksResult.error) {
      throw tasksResult.error
    }

    if (emailsResult.error) {
      throw emailsResult.error
    }

    return Response.json({
      ...formatContact(contact),
      recent_tasks: (tasksResult.data ?? []).map((row) => formatTask(row as never)),
      recent_emails: emailsResult.data ?? [],
    })
  } catch (error) {
    return jsonError(error, 'Failed to load contact')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    await getContactById(id)

    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = optionalString(body.name)
      if (!name) {
        return Response.json({ error: 'name is required' }, { status: 400 })
      }
      patch.name = name
    }

    if (body.company !== undefined) patch.company = optionalString(body.company)
    if (body.email !== undefined) patch.email = optionalString(body.email)
    if (body.phone !== undefined) patch.phone = optionalString(body.phone)
    if (body.role !== undefined) patch.role = optionalString(body.role)
    if (body.account_id !== undefined) patch.account_id = optionalString(body.account_id)
    if (body.notes !== undefined) patch.notes = optionalString(body.notes)

    if (body.status !== undefined) {
      patch.status = parseContactStatus(body.status)
    }

    if (body.workstream !== undefined) {
      const slug = optionalString(body.workstream)
      patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .select(CONTACT_SELECT)
      .single()

    if (error) {
      throw error
    }

    return Response.json(formatContact(data as never))
  } catch (error) {
    return jsonError(error, 'Failed to update contact')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    await getContactById(id)

    const { error } = await supabaseService
      .from('contacts')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      throw error
    }

    return Response.json({ archived: true })
  } catch (error) {
    return jsonError(error, 'Failed to archive contact')
  }
}
