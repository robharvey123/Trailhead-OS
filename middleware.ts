import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isLocalDevelopmentHost } from '@/lib/site'

const publicRoutes = ['/login', '/auth/callback', '/discovery']
const publicRoutePrefixes = ['/report']
const publicApiPrefixes = ['/api/enquiries', '/api/contact']

function getMarketingRewritePath(pathname: string) {
  if (pathname === '/') {
    return '/marketing'
  }

  if (
    pathname === '/blog' ||
    pathname.startsWith('/blog/') ||
    pathname === '/mvp-cricket' ||
    pathname.startsWith('/mvp-cricket/') ||
    pathname === '/privacy' ||
    pathname.startsWith('/privacy/')
  ) {
    return `/marketing${pathname}`
  }

  return null
}

function getOsRewritePath(pathname: string) {
  if (
    pathname === '/blog' ||
    pathname === '/blog/new' ||
    /^\/blog\/[^/]+\/edit$/.test(pathname)
  ) {
    return `/os${pathname}`
  }

  return null
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const isAppSubdomain = hostname.startsWith('app.')
  const isLocalhost = isLocalDevelopmentHost(hostname)
  const siteParam = request.nextUrl.searchParams.get('site')
  const isMarketingSite = isLocalhost
    ? siteParam === 'marketing'
    : !isAppSubdomain
  const pathname = request.nextUrl.pathname
  const isApiRequest = pathname.startsWith('/api/')

  if (isMarketingSite && !isApiRequest) {
    const marketingRewritePath = getMarketingRewritePath(pathname)

    if (!marketingRewritePath) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (marketingRewritePath === pathname) {
      return NextResponse.next()
    }

    const marketingUrl = request.nextUrl.clone()
    marketingUrl.pathname = marketingRewritePath
    return NextResponse.rewrite(marketingUrl)
  }

  const osRewritePath = isMarketingSite ? null : getOsRewritePath(pathname)
  const rewriteUrl = osRewritePath
    ? (() => {
        const url = request.nextUrl.clone()
        url.pathname = osRewritePath
        return url
      })()
    : null
  const response = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl)
    : NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic =
    publicRoutes.includes(pathname) ||
    publicRoutePrefixes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    ) ||
    publicApiPrefixes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )

  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/workspaces', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js).*)'],
}
