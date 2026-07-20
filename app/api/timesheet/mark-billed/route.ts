import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markTimeEntriesAsBilled } from '@/lib/db/timesheet'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!Array.isArray(body.time_entry_ids) || body.time_entry_ids.length === 0) {
      return NextResponse.json(
        { error: 'time_entry_ids array is required' },
        { status: 400 }
      )
    }

    if (!body.invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }

    await markTimeEntriesAsBilled(body.time_entry_ids, body.invoice_id, supabase)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mark time as billed' },
      { status: 500 }
    )
  }
}
