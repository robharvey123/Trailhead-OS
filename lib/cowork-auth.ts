import { NextRequest } from 'next/server'
import { safeEqual } from '@/lib/auth/safe-equal'

export function validateCoworkToken(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  return safeEqual(token, process.env.COWORK_API_KEY)
}
