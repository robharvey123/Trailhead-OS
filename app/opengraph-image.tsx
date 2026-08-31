// app/opengraph-image.tsx
// The site-wide OG card, 1200x630, drawn in the bay plan. See lib/og.tsx.

import { ImageResponse } from 'next/og'
import { OG, OG_SIZE, OgCard, loadArchivo } from '@/lib/og'

export const runtime = 'edge'
export const alt =
  'Trailhead Holdings, commercial strategy and product development'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function OpengraphImage() {
  const fonts = await loadArchivo()

  return new ImageResponse(
    (
      <OgCard wordmark="Holdings Ltd" footer="trailheadholdings.uk">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Satori throws on any element with more than one child unless
              display is explicit, so each line is its own flex row rather
              than a <br/>-separated block. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: OG.ink,
            }}
          >
            <div style={{ display: 'flex' }}>Thirteen years selling</div>
            <div style={{ display: 'flex' }}>in hard markets. Now</div>
            <div style={{ display: 'flex' }}>building the software too.</div>
          </div>
          <div style={{ display: 'flex', fontSize: 27, color: OG.ink2, marginTop: 26 }}>
            Commercial strategy for nicotine and FMCG brands. Bespoke software.
          </div>
        </div>
      </OgCard>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
