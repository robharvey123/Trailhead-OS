import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseImportPayload,
  validateContactRows,
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

  // Build account name → id mapping for resolving account_name column
  const { data: accounts } = await supabase
    .from('crm_accounts')
    .select('id, name')
    .eq('workspace_id', crmWorkspaceId)

  const accountNameMap = new Map<string, string>()
  for (const a of accounts || []) {
    accountNameMap.set(a.name.toLowerCase(), a.id)
  }

  const { validRows, rejected } = validateContactRows(
    rows,
    crmWorkspaceId,
    user.id,
    accountNameMap,
    rowOffset
  )

  if (!validRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  // Deduplicate by first+last+email within import
  const seen = new Set<string>()
  const uniqueRows = validRows.filter((entry) => {
    const key = `${entry.data.first_name}|${entry.data.last_name}|${entry.data.email || ''}`.toLowerCase()
    if (seen.has(key)) {
      rejected.push({ row: entry.row, reason: 'Duplicate contact in import file.' })
      return false
    }
    seen.add(key)
    return true
  })

  if (!uniqueRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  const insertRows = uniqueRows.map((r) => r.data)
  let inserted = 0

  for (const chunk of chunkArray(insertRows, 500)) {
    const { error } = await supabase.from('crm_contacts').insert(chunk)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    inserted += chunk.length
  }

  return NextResponse.json({ inserted, rejected })
}
