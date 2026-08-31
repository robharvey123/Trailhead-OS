// lib/marketing/tracks.ts
// The marketing site is one domain carrying three sub-brands. Every page
// resolves to a track from its pathname, and the track supplies the chrome:
// wordmark, bay code, nav, primary CTA and the quiet cross-track link.
// Consulting and software are separate businesses with separate buyers. The
// track keeps the chrome saying the same thing as the page.
//
// Under the bay-plan world a track is a brand block: one keyed colour that
// owns whole regions of the page rather than tinting details. The colour
// values live in app/(marketing)/bay.css, selected by [data-track]; this file
// carries only the identity that is content — code, wordmark, nav, CTA.

export type Track = 'holdings' | 'commercial' | 'studio' | 'labs'

export interface TrackNavItem {
  label: string
  href: string
  external?: boolean
}

export interface TrackTokens {
  track: Track
  /** Second line of the wordmark, under "Trailhead". */
  wordmark: string
  /** Printed on the rail: the bay this track occupies on the plan. */
  bayCode: string
  /** The dimension callout beside the bay code. Facts only. */
  bayMeasure: string
  nav: TrackNavItem[]
  cta: { label: string; href: string } | null
  crossLink: { label: string; href: string } | null
}

const TRACKS: Record<Track, TrackTokens> = {
  holdings: {
    track: 'holdings',
    wordmark: 'HOLDINGS LTD',
    bayCode: 'BAY 00',
    bayMeasure: 'EST. 2014 · BRENTWOOD, ESSEX',
    nav: [
      { label: 'Commercial', href: '/consulting' },
      { label: 'Studio', href: '/studio' },
      { label: 'Labs', href: '/labs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
    // The two doors carry the offer, but they sit below the fold, so the
    // header keeps a visible primary action. Without it the only button on the
    // homepage was Log in, which is an action for one person.
    cta: { label: 'Start a conversation', href: '/contact' },
    crossLink: null,
  },
  commercial: {
    track: 'commercial',
    wordmark: 'COMMERCIAL',
    bayCode: 'BAY 01',
    bayMeasure: 'NGP · FMCG · UK/EU/DACH/SE',
    nav: [
      { label: 'Services', href: '/consulting#services' },
      // Five items per track, which is what the 1100px header fits alongside
      // the cross-track link, the CTA and Log in. Current work displaces
      // Sectors rather than joining it: a live client is proof, the sector
      // chips are decoration, and the section is still there on scroll.
      { label: 'Current work', href: '/consulting#current-work' },
      { label: 'Track record', href: '/consulting#track-record' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact?track=commercial' },
    ],
    cta: { label: 'Start a conversation', href: '/contact?track=commercial' },
    crossLink: { label: 'Looking for software?', href: '/studio' },
  },
  studio: {
    track: 'studio',
    wordmark: 'STUDIO',
    bayCode: 'BAY 02',
    bayMeasure: 'BESPOKE SOFTWARE · IN-HOUSE',
    nav: [
      { label: 'Services', href: '/studio#services' },
      { label: 'Work', href: '/studio#work' },
      { label: 'Process', href: '/studio#process' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact?track=studio' },
    ],
    cta: { label: 'Scope a build', href: '/contact?track=studio' },
    crossLink: { label: 'Looking for consulting?', href: '/consulting' },
  },
  labs: {
    track: 'labs',
    wordmark: 'LABS',
    bayCode: 'BAY 03',
    bayMeasure: 'OWNED PRODUCTS · LIVE BILLING',
    nav: [
      { label: 'Engineer OS', href: 'https://engineeros.uk', external: true },
      { label: 'MVP Cricket', href: 'https://mvpcricket.app', external: true },
      { label: 'MVP Predictor', href: '/labs/mvp-predictor' },
      { label: 'Contact', href: '/contact?track=labs' },
    ],
    // Labs sells nothing on this domain. Each card is the door out.
    cta: null,
    crossLink: null,
  },
}

export function trackFromPathname(pathname: string): Track {
  const path = pathname.split(/[?#]/)[0]

  if (path === '/consulting' || path.startsWith('/consulting/')) {
    return 'commercial'
  }
  if (path === '/studio' || path.startsWith('/studio/')) {
    return 'studio'
  }
  if (path === '/labs' || path.startsWith('/labs/')) {
    return 'labs'
  }

  return 'holdings'
}

export function getTrackTokens(track: Track): TrackTokens {
  return TRACKS[track]
}
