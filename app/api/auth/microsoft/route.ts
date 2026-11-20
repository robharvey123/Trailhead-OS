import type { NextRequest } from 'next/server'
import { getMicrosoftAuthUrl } from '@/lib/microsoft/oauth'
import { startOAuth } from '@/lib/auth/oauth-state'

export async function GET(request: NextRequest) {
  return startOAuth(request, 'microsoft', getMicrosoftAuthUrl)
}
