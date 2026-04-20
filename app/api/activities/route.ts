import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createActivity, getActivities } from '@/lib/db/activities'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const activities = await getActivities(
      {
        account_id: searchParams.get('account_id') ?? undefined,
        contact_id: searchParams.get('contact_id') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ activities })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load activities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))

  if (!body.type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  try {
    const activity = await createActivity(
      {
        account_id: body.account_id ?? null,
        contact_id: body.contact_id ?? null,
        type: body.type,
        subject: body.subject ?? null,
        notes: body.notes ?? null,
        activity_date: body.activity_date ?? null,
        next_action: body.next_action ?? null,
        next_action_date: body.next_action_date ?? null,
      },
      auth.supabase
    )

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create activity' },
      { status: 500 }
    )
  }
}
