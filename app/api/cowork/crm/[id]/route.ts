import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  TASK_SELECT,
  formatContact,
  formatTask,
  getContactById,
  jsonError,
} from '@/lib/cowork-api'
import { archiveCoworkContact, updateCoworkContact } from '@/lib/cowork-contacts'
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

// PATCH — any of CONTACT_PATCH_FIELDS (lib/cowork-contacts.ts).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    return Response.json(await updateCoworkContact(id, body))
  } catch (error) {
    return jsonError(error, 'Failed to update contact')
  }
}

// DELETE — soft archive (status → archived); the row is never removed.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    return Response.json(await archiveCoworkContact(id))
  } catch (error) {
    return jsonError(error, 'Failed to archive contact')
  }
}
