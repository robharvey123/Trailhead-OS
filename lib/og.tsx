// Shared furniture for the two Open Graph cards.
//
// The cards are the site's first impression in a LinkedIn or WhatsApp preview,
// which for this audience is often before the site itself. They are drawn in
// the bay plan: plan stock, a black rail with tick marks, the mark, condensed
// display in ink, mono at the foot. Anything else would put a stranger's first
// look at Trailhead in a visual world the site no longer uses.

import type { CSSProperties, ReactElement } from 'react'

export const OG_SIZE = { width: 1200, height: 630 }

/** The bay plan's tokens, inlined — Satori resolves no CSS variables. */
export const OG = {
  plan: '#E7EAE4',
  ink: '#14161A',
  ink2: '#4A4F55',
  ink3: '#595E64',
  hair: 'rgba(20,22,26,0.22)',
  flash: '#DA2818',
} as const

/**
 * Archivo, fetched as a static TTF so the card is set in the site's own face
 * rather than whatever `system-ui` resolves to on the render host. Returns an
 * empty list when the fetch fails, and the card still renders — a social image
 * that 500s is worse than one in a fallback face.
 */
export async function loadArchivo(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]
> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Archivo:wght@400;700',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ).then((r) => r.text())

    const urls = [...css.matchAll(/src:\s*url\((https:[^)]+\.ttf)\)/g)].map(
      (m) => m[1]
    )
    if (urls.length < 2) return []

    const [regular, bold] = await Promise.all([
      fetch(urls[0]).then((r) => r.arrayBuffer()),
      fetch(urls[urls.length - 1]).then((r) => r.arrayBuffer()),
    ])

    return [
      { name: 'Archivo', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Archivo', data: bold, weight: 700 as const, style: 'normal' as const },
    ]
  } catch {
    return []
  }
}

/** The rail: a solid rule with tick marks at a fixed pitch. */
export function Rail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', width: '100%', height: 2, background: OG.ink }} />
      <div style={{ display: 'flex', width: '100%', height: 10 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{ display: 'flex', width: 1, height: 10, background: OG.hair, marginRight: 26 }}
          />
        ))}
      </div>
    </div>
  )
}

/** Four ascending bars: the one piece of identity that carries over unchanged. */
export function Mark({ keyed = OG.ink }: { keyed?: string }) {
  const bars = [
    { h: 14, c: OG.ink },
    { h: 27, c: OG.ink },
    { h: 40, c: OG.ink },
    { h: 51, c: keyed },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 51 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          style={{ display: 'flex', width: 13, height: b.h, background: b.c, marginRight: 3 }}
        />
      ))}
    </div>
  )
}

const labelStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 3,
  textTransform: 'uppercase',
  color: OG.ink3,
}

/** The card shell: mark and wordmark, rail, slot, rail, footer. */
export function OgCard({
  wordmark,
  children,
  footer,
}: {
  wordmark: string
  children: ReactElement
  footer: string
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG.plan,
        color: OG.ink,
        fontFamily: 'Archivo, system-ui, sans-serif',
        padding: '56px 64px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Mark />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
              TRAILHEAD
            </div>
            <div style={{ display: 'flex', ...labelStyle, fontSize: 17, marginTop: 4 }}>
              {wordmark}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', ...labelStyle }}>Est. 2014</div>
      </div>

      <Rail />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        {children}
      </div>

      <Rail />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 20,
        }}
      >
        <div style={{ display: 'flex', ...labelStyle }}>{footer}</div>
        <div style={{ display: 'flex', width: 60, height: 8, background: OG.flash }} />
      </div>
    </div>
  )
}
