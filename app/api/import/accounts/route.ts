import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseImportPayload,
  validateAccountRows,
} from '@/lib/import/validation'
import { chunkArray } from '@/lib/import/utils'
import { getCrmWorkspaceId } from '@/lib/crm/workspace'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseImportPayload(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { workspaceId, rows, rowOffset } = parsed.data

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Workspace access denied.' }, { status: 403 })
  }

  const crmWorkspaceId = await getCrmWorkspaceId(supabase, workspaceId)

  const { validRows, rejected } = validateAccountRows(
    rows,
    crmWorkspaceId,
    user.id,
    rowOffset
  )

  if (!validRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  // Deduplicate by name within import
  const seen = new Set<string>()
  const uniqueRows = validRows.filter((entry) => {
    const key = entry.data.name.toLowerCase()
    if (seen.has(key)) {
      rejected.push({ row: entry.row, reason: 'Duplicate name in import file.' })
      return false
    }
    seen.add(key)
    return true
  })

  if (!uniqueRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  // Skip accounts that already exist by name
  const { data: existing } = await supabase
    .from('crm_accounts')
    .select('name')
    .eq('workspace_id', crmWorkspaceId)

  const existingNames = new Set(
    (existing || []).map((a) => a.name.toLowerCase())
  )

  const newRows = uniqueRows.filter((entry) => {
    if (existingNames.has(entry.data.name.toLowerCase())) {
      rejected.push({ row: entry.row, reason: 'Account already exists.' })
      return false
    }
    return true
  })

  if (!newRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  const insertRows = newRows.map((r) => r.data)
  let inserted = 0

  for (const chunk of chunkArray(insertRows, 500)) {
    const { error } = await supabase.from('crm_accounts').insert(chunk)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    inserted += chunk.length
  }

  return NextResponse.json({ inserted, rejected })
}
