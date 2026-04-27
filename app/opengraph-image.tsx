// app/opengraph-image.tsx
// Generates the default site-wide OG image at build time. 1200x630 PNG.

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Trailhead Holdings, commercial strategy and product development'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #0b1220 0%, #1a2840 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.7,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Trailhead Holdings
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
            Commercial strategy.
            <br />
            Digital products.
            <br />
            Built to last.
          </div>
          <div style={{ fontSize: 28, opacity: 0.8 }}>
            NGP and FMCG consulting. Bespoke software. SaaS ventures.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            opacity: 0.7,
          }}
        >
          <span>trailheadholdings.uk</span>
          <span>UK</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
