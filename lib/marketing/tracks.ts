// lib/marketing/tracks.ts
// The marketing site is one domain carrying three sub-brands. Every page
// resolves to a track from its pathname, and the track supplies the chrome:
// wordmark, bay code, sections, primary CTA.
//
// Navigation is two-tier, the way a bay plan is read: you pick the bay, then
// the shelf. The three businesses are constant and always reachable from every
// page (BUSINESSES, below), and the rail beneath the header carries the
// sections of whichever bay you are standing in. Before this, standing on
// /studio you could reach Commercial only through one quiet cross-link and
// Labs not at all.
//
// Under the bay-plan world a track is a brand block: one keyed colour that
// owns whole regions of the page rather than tinting details. The colour
// values live in app/(marketing)/bay.css, selected by [data-track]; this file
// carries only the identity that is content — code, wordmark, sections, CTA.

export type Track = 'holdings' | 'commercial' | 'studio' | 'labs'

export interface TrackNavItem {
  label: string
  href: string
  external?: boolean
}

export interface BusinessNavItem extends TrackNavItem {
  /** Which track this business owns, so the current one can be marked. */
  track: Track
}

export interface TrackTokens {
  track: Track
  /** Second line of the wordmark, under "Trailhead". */
  wordmark: string
  /** Printed on the rail: the bay this track occupies on the plan. */
  bayCode: string
  /**
   * The measure printed beside the bay code. Facts only. It shows on the rail
   * wherever a track has no sections of its own to carry instead.
   */
  bayMeasure: string
  /** Tier two: the shelves inside this bay. Empty where the bay has none. */
  sections: TrackNavItem[]
  cta: { label: string; href: string } | null
}

/**
 * Tier one. The three businesses, constant across every page. This is the
 * whole point of the two-tier nav: a visitor who lands on any page can see
 * that Trailhead is three things and reach all of them.
 */
export const BUSINESSES: BusinessNavItem[] = [
  { label: 'Commercial', href: '/consulting', track: 'commercial' },
  { label: 'Studio', href: '/studio', track: 'studio' },
  { label: 'Labs', href: '/labs', track: 'labs' },
]

/** Always present, on every track, beside the businesses. */
export const UTILITY_NAV: TrackNavItem[] = [
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
]

const TRACKS: Record<Track, TrackTokens> = {
  holdings: {
    track: 'holdings',
    wordmark: 'HOLDINGS LTD',
    bayCode: 'BAY 00',
    bayMeasure: 'EST. 2014 · BRENTWOOD, ESSEX',
    // The homepage's own sections are the three businesses, and those are
    // tier one now, so the rail keeps the registration facts instead.
    sections: [],
    // The two doors carry the offer, but they sit below the fold, so the
    // header keeps a visible primary action. Without it the only button on the
    // homepage was Log in, which is an action for one person.
    cta: { label: 'Start a conversation', href: '/contact' },
  },
  commercial: {
    track: 'commercial',
    wordmark: 'COMMERCIAL',
    bayCode: 'BAY 01',
    bayMeasure: 'NGP · FMCG · UK/EU/DACH/SE',
    sections: [
      { label: 'Services', href: '/consulting#services' },
      { label: 'Sectors', href: '/consulting#sectors' },
      { label: 'Current work', href: '/consulting#current-work' },
      { label: 'Track record', href: '/consulting#track-record' },
    ],
    cta: { label: 'Start a conversation', href: '/contact?track=commercial' },
  },
  studio: {
    track: 'studio',
    wordmark: 'STUDIO',
    bayCode: 'BAY 02',
    bayMeasure: 'BESPOKE SOFTWARE · IN-HOUSE',
    sections: [
      { label: 'Services', href: '/studio#services' },
      { label: 'Work', href: '/studio#work' },
      { label: 'Process', href: '/studio#process' },
    ],
    cta: { label: 'Scope a build', href: '/contact?track=studio' },
  },
  labs: {
    track: 'labs',
    wordmark: 'LABS',
    bayCode: 'BAY 03',
    bayMeasure: 'OWNED PRODUCTS · LIVE BILLING',
    // Labs sells nothing on this domain, so its shelves are the products
    // themselves and two of the three lead off-site.
    sections: [
      { label: 'Engineer OS', href: 'https://engineeros.uk', external: true },
      { label: 'MVP Cricket', href: 'https://mvpcricket.app', external: true },
      { label: 'MVP Predictor', href: '/labs/mvp-predictor' },
    ],
    cta: null,
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
