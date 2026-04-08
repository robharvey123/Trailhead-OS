import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload receipt' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(path)

    const receiptUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('expenses')
      .update({ receipt_url: receiptUrl })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to save receipt URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ receipt_url: receiptUrl })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload receipt' },
      { status: 500 }
    )
  }
}
