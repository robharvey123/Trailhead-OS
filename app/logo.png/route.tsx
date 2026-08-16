// Serves a real raster logo at /logo.png.
//
// components/JsonLd.tsx points Organization.logo and BlogPosting.publisher.logo
// at ${SITE_URL}/logo.png, but public/ only ever contained SVGs — so both
// resolved to a 404 and failed Google's rich-result validation. Generating it
// with next/og keeps a single source of truth (no committed binary to drift out
// of sync with the SVG) and matches how app/opengraph-image.tsx already works.

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'

// Google wants an organisation logo of at least 112x112.
const SIZE = { width: 512, height: 512 }

// The bar-chart mark from public/logo.svg, scaled up.
const BARS = [
  { height: 60, colour: '#0F172A' },
  { height: 120, colour: '#0F172A' },
  { height: 180, colour: '#0F172A' },
  { height: 228, colour: '#0EA5E9' },
]

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: '#FFFFFF',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 228 }}>
          {BARS.map((bar) => (
            <div
              key={bar.height}
              style={{
                width: 48,
                height: bar.height,
                borderRadius: 10,
                background: bar.colour,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: '#0F172A', letterSpacing: -1 }}>
            Trailhead
          </div>
          <div style={{ fontSize: 22, color: '#475569', letterSpacing: 6 }}>HOLDINGS LTD</div>
        </div>
      </div>
    ),
    SIZE
  )
}
