import type { MetadataRoute } from 'next'

/**
 * Web app manifest, so Trailhead OS can be added to an iPad or phone Home
 * Screen and open full screen. start_url is /login: signed-in users are sent
 * on by middleware (the Sales Lead to /sales/dashboard, staff to the OS).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trailhead OS',
    short_name: 'Trailhead',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0F172A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
