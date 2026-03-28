import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({ workspaceId: z.string().uuid() })
const ChangePasswordSchema = z.object({ userId: z.string(), password: z.string().min(6) })

type WorkspaceMemberRow = {
  user_id: string
  role: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  const parsed = QuerySchema.safeParse({ workspaceId })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid workspaceId.' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: members, error: memberError } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }
  const { data: users, error: userError } = await admin.auth.admin.listUsers()
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }
  const userMap = Object.fromEntries(users.users.map((user: User) => [user.id, user]))
  const result = (members as WorkspaceMemberRow[]).map((member) => ({
    id: member.user_id,
    email: userMap[member.user_id]?.email || '',
    role: member.role,
    lastSignIn: userMap[member.user_id]?.last_sign_in_at || null,
  }))
  return NextResponse.json({ users: result })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { userId, password } = parsed.data
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
