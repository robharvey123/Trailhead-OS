import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const InviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']).default('viewer'),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { workspaceId, email, password, role } = parsed.data
  const admin = createAdminClient()

  // 1. Create user if not exists
  let userId: string
  const { data: users, error: listError } = await admin.auth.admin.listUsers()
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
  const existing = users.users.find((u) => u.email === email)
  if (existing) {
    userId = existing.id
  } else {
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    })
    if (createError || !data.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user.' }, { status: 500 })
    }
    userId = data.user.id
  }

  // 2. Add to workspace_members
  const { error: memberError } = await admin.from('workspace_members').upsert({
    workspace_id: workspaceId,
    user_id: userId,
    role,
  })
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
