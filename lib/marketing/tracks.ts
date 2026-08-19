// lib/marketing/tracks.ts
// The marketing site is one domain carrying three sub-brands. Every page
// resolves to a track from its pathname, and the track supplies the chrome:
// wordmark, accent tokens, nav, primary CTA and the quiet cross-track link.
// Consulting and software are separate businesses with separate buyers. The
// track keeps the chrome saying the same thing as the page.

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
  accent: string
  /** Darker shade for hover states on accent-filled elements. */
  accentStrong: string
  /** Tinted background for hover states on outlined elements. */
  accentSoft: string
  /** Tinted border for hover states on outlined elements. */
  accentBorder: string
  nav: TrackNavItem[]
  cta: { label: string; href: string } | null
  crossLink: { label: string; href: string } | null
}

const TRACKS: Record<Track, TrackTokens> = {
  holdings: {
    track: 'holdings',
    wordmark: 'HOLDINGS LTD',
    accent: '#0F172A',
    accentStrong: '#1E293B',
    accentSoft: '#F1F5F9',
    accentBorder: '#CBD5E1',
    nav: [
      { label: 'Commercial', href: '/consulting' },
      { label: 'Studio', href: '/studio' },
      { label: 'Labs', href: '/labs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
    // The homepage's two doors are the CTA, so the header stays quiet.
    cta: null,
    crossLink: null,
  },
  commercial: {
    track: 'commercial',
    wordmark: 'COMMERCIAL',
    // Consulting is bought on seniority: same palette family as Studio's sky,
    // deeper register.
    accent: '#0B4A6F',
    accentStrong: '#083A57',
    accentSoft: '#EFF6FA',
    accentBorder: '#B6D3E4',
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
    accent: '#0EA5E9',
    accentStrong: '#0284C7',
    accentSoft: '#F0F9FF',
    accentBorder: '#7DD3FC',
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
    accent: '#7C3AED',
    accentStrong: '#6D28D9',
    accentSoft: '#F5F3FF',
    accentBorder: '#C4B5FD',
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
