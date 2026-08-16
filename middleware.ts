import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isLocalDevelopmentHost } from '@/lib/site'

const publicRoutes = [
  '/',
  '/login',
  '/auth/callback',
  '/discovery',
  '/privacy',
  '/terms',
  '/contact',
  '/unsubscribe',
  '/unsubscribed',
  '/api/auth/google',
  '/api/auth/google/callback',
]
const publicRoutePrefixes = ['/report', '/auth/claim']
// /api/cron/* is invoked by Vercel Cron with no session cookie — the middleware
// must not redirect it to /login (that 307 silently blocked every cron since the
// middleware shipped). Each cron route enforces its own CRON_SECRET check.
// /api/mcp is the MCP server — bearer-token authed in the route (same COWORK_API_KEY
// as /api/cowork). It must be public to middleware or the 307-to-login breaks every
// MCP call, exactly like the cron regression noted above.
// /api/webhooks/resend is Svix-signature-verified in the route (RESEND_WEBHOOK_SECRET);
// /api/outreach/unsubscribe is public by design (List-Unsubscribe one-click). Both
// must be public to middleware or the 307-to-login makes Resend record every event
// as failed — the same regression the cron/MCP comment above describes.
const publicApiPrefixes = ['/api/enquiries', '/api/contact', '/api/calendar/ical', '/api/cowork', '/api/cron', '/api/mcp', '/api/webhooks/resend', '/api/outreach/unsubscribe']
const PUBLIC_ASSET_PATTERN = /\.[^/]+$/

// Next's generated metadata images (app/opengraph-image.tsx and friends) are
// served at extensionless paths, so PUBLIC_ASSET_PATTERN above does not match
// them and they were being auth-gated — a social crawler following og:image got
// a 307 to /login instead of the picture. Crawlers are never authenticated, so
// these must be public.
const METADATA_IMAGE_PATTERN =
  /^\/(opengraph-image|twitter-image|icon|apple-icon)(\/|$)/

function getMarketingRewritePath(pathname: string) {
  if (pathname === '/') {
    return '/marketing'
  }

  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/contact') {
    return pathname
  }

  // Every public marketing route lives here. A path missing from this list is
  // redirected to '/' by the caller, so adding a page means adding it here too.
  const marketingRoots = [
    '/blog',
    '/consulting',
    '/products',
    '/engineer-os',
    '/mvp-cricket',
    '/bright-fire',
    '/web-app-design',
  ]

  if (
    marketingRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`)
    )
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
  const isPublicAsset =
    PUBLIC_ASSET_PATTERN.test(pathname) || METADATA_IMAGE_PATTERN.test(pathname)

  if (isPublicAsset) {
    return NextResponse.next()
  }

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

  // API key bypass for programmatic access (e.g. cowork agent)
  // Early return before Supabase session check — signal downstream via header
  if (isApiRequest) {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (apiKey && apiKey === process.env.COWORK_API_KEY) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-api-key-verified', 'true')
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

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

  // Admin-only area: only owner/admin profiles may enter /admin/*.
  if (user && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|api/webhooks/stripe).*)'],
}
