import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getAttachmentBytes } from '@/lib/google/gmail'
import type { EmailAttachmentMeta } from '@/lib/types'

// Gmail caps attachments at 25MB; guard a little above that.
const MAX_BYTES = 26 * 1024 * 1024

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { messageId, attachmentId } = await params

    // Validate the message is one of ours and pull the stored metadata (filename,
    // mime, size) — this is the ownership check as well as the source of the name.
    const { data: row } = await supabase
      .from('email_logs')
      .select('attachments')
      .eq('gmail_message_id', messageId)
      .maybeSingle<{ attachments: EmailAttachmentMeta[] | null }>()

    if (!row) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    const meta = (row.attachments ?? []).find((a) => a.attachment_id === attachmentId)
    if (!meta) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    if (meta.size_bytes > MAX_BYTES) return NextResponse.json({ error: 'Attachment too large' }, { status: 413 })

    const bytes = await getAttachmentBytes(messageId, attachmentId)
    const safeName = meta.filename.replace(/["\\\r\n]/g, '_')

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': meta.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': String(bytes.length),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attachment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
