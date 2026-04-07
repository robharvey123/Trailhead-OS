import { NextResponse } from 'next/server'
import { getMicrosoftAuthUrl } from '@/lib/microsoft/oauth'

export async function GET() {
  return NextResponse.redirect(getMicrosoftAuthUrl())
}
