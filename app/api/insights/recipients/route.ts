import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const RecipientsSchema = z.object({
  workspaceId: z.string().uuid(),
  recipients: z.array(z.string().email()),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = RecipientsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { workspaceId, recipients } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin', 'editor'].includes(member.role)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('workspace_settings')
    .update({ insights_recipients: recipients })
    .eq('workspace_id', workspaceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
