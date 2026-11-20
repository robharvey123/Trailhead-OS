import type { NextRequest } from 'next/server'
import { getAuthUrl } from '@/lib/google/oauth'
import { startOAuth } from '@/lib/auth/oauth-state'

export async function GET(request: NextRequest) {
  return startOAuth(request, 'google', getAuthUrl)
}
