import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isLocalDevelopmentHost } from '@/lib/site'
import { safeEqual } from '@/lib/auth/safe-equal'

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
const publicRoutePrefixes = ['/report', '/auth/claim', '/auth/confirm', '/auth/accept']

// The Sales Lead seat (profiles.role = 'sales') is deny-by-default: it may reach
// only these prefixes (plus the public routes above). Everything else redirects
// to its dashboard, or 403s for /api. RLS is the real control; this keeps the
// seat off the 30-odd service-role API routes and every finance page.
const SALES_ALLOWED_PREFIXES = ['/sales', '/api/sales', '/auth', '/logout']
const SALES_HOME = '/sales/dashboard'
// /api/cron/* is invoked by Vercel Cron with no session cookie, so the middleware
// must not redirect it to /login (that 307 silently blocked every cron since the
// middleware shipped). Each cron route enforces its own CRON_SECRET check.
// /api/mcp is the MCP server, bearer-token authed in the route (same COWORK_API_KEY
// as /api/cowork). It must be public to middleware or the 307-to-login breaks every
// MCP call, exactly like the cron regression noted above.
// /api/webhooks/resend is Svix-signature-verified in the route (RESEND_WEBHOOK_SECRET);
// /api/outreach/unsubscribe is public by design (List-Unsubscribe one-click). Both
// must be public to middleware or the 307-to-login makes Resend record every event
// as failed, the same regression the cron/MCP comment above describes.
const publicApiPrefixes = ['/api/enquiries', '/api/contact', '/api/calendar/ical', '/api/cowork', '/api/cron', '/api/mcp', '/api/webhooks/resend', '/api/outreach/unsubscribe']
const PUBLIC_ASSET_PATTERN = /\.[^/]+$/

// Next's generated metadata images (app/opengraph-image.tsx and friends) are
// served at extensionless paths, so PUBLIC_ASSET_PATTERN above does not match
// them and they were being auth-gated, so a social crawler following og:image got
// a 307 to /login instead of the picture. Crawlers are never authenticated, so
// these must be public.
const METADATA_IMAGE_PATTERN =
  /^\/(opengraph-image|twitter-image|icon|apple-icon)(\/|$)/

// Retired marketing paths. These pages had indexed history and backlinks, and
// the fallback below answers any unknown path with a 404, which tells Google the
// old page is gone and drops its ranking. Each retiree therefore gets an
// explicit 301 to its successor.
const marketingPermanentRedirects: Record<string, string> = {
  '/web-app-design': '/studio',
  '/products': '/labs',
  // Products with their own live marketing domains no longer get a second
  // page here: duplicate content splits whatever authority they earn.
  '/engineer-os': 'https://engineeros.uk',
  '/mvp-cricket': 'https://mvpcricket.app',
  // BrightFire is client work, not a product: its case study lives on /studio.
  '/bright-fire': '/studio',
}

function getMarketingRewritePath(pathname: string) {
  if (pathname === '/') {
    return '/marketing'
  }

  if (pathname === '/privacy' || pathname === '/terms' || pathname === '/contact') {
    return pathname
  }

  // Every public marketing route lives here. A path missing from this list gets
  // a 404 from the caller, so adding a page means adding it here too.
  const marketingRoots = [
    '/about',
    '/blog',
    '/consulting',
    '/studio',
    '/labs',
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
  // Vercel preview deployments (*.vercel.app) behave like localhost: the OS by
  // default, the marketing site with ?site=marketing. Without this a preview
  // only ever served marketing, so OS changes could not be checked before merge.
  const isLocalhost = isLocalDevelopmentHost(hostname) || process.env.VERCEL_ENV === 'preview'
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
    const permanentTarget = marketingPermanentRedirects[pathname]
    if (permanentTarget) {
      if (permanentTarget.startsWith('http')) {
        // Carry the query across the hop. new URL() starts empty, so without
        // this a campaign link to /engineer-os?utm_source=... arrives at the
        // product domain stripped of its attribution, and the send that
        // generated the click looks like it produced nothing.
        const externalUrl = new URL(permanentTarget)
        request.nextUrl.searchParams.forEach((value, key) => {
          // 'site' is the localhost-only marketing-host switch and means
          // nothing off this origin.
          if (key !== 'site') {
            externalUrl.searchParams.set(key, value)
          }
        })
        return NextResponse.redirect(externalUrl, 301)
      }
      // Clone keeps the query string, so localhost's ?site=marketing survives.
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = permanentTarget
      return NextResponse.redirect(redirectUrl, 301)
    }

    const marketingRewritePath = getMarketingRewritePath(pathname)

    if (!marketingRewritePath) {
      // Unknown path: let the marketing catch-all (app/(marketing)/marketing/
      // [...path]) answer with the marketing 404 and a real 404 status. This
      // used to 307 to '/', which search engines treat as a soft 404 and which
      // hid genuinely dead links.
      const notFoundUrl = request.nextUrl.clone()
      notFoundUrl.pathname = `/marketing${pathname}`
      return NextResponse.rewrite(notFoundUrl)
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
  // x-api-key-verified is only ever set by this middleware (below). Drop any
  // copy the client sent so it can never reach getApiKeyAuth() forged.
  const sanitisedHeaders = new Headers(request.headers)
  sanitisedHeaders.delete('x-api-key-verified')
  const response = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: sanitisedHeaders } })
    : NextResponse.next({ request: { headers: sanitisedHeaders } })

  // API key bypass for programmatic access (e.g. cowork agent)
  // Early return before Supabase session check, signal downstream via header
  if (isApiRequest) {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (safeEqual(apiKey, process.env.COWORK_API_KEY)) {
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

  const role = user
    ? ((await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()).data?.role as string | undefined)
    : undefined

  if (user && role === 'sales') {
    const inAllowedPrefix = SALES_ALLOWED_PREFIXES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
    // '/' and '/login' are public routes, but the seat's home is its dashboard.
    if (pathname === '/' || pathname === '/login' || (!inAllowedPrefix && !isPublic)) {
      if (isApiRequest) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL(SALES_HOME, request.url))
    }
    return response
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/workspaces', request.url))
  }

  // Admin-only area: only owner/admin profiles may enter /admin/*.
  if (user && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|api/webhooks/stripe).*)'],
}
