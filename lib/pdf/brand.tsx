import { Svg, Rect, Text, View, StyleSheet } from '@react-pdf/renderer'
import { BRAND as BASE, BRAND_ARGB, COMPANY } from '@/lib/brand'

/**
 * Shared Trailhead brand for produced documents (invoice, quote, engagement
 * report). The brand colours and company details come from lib/brand.ts, the
 * one source shared by web, PDF and email. This module adds the values that
 * are specific to print (body ink, muted text, hairlines) and the PDF logo.
 */
export const BRAND = {
  navy: BASE.navy, // logo bars / masthead / headings
  blue: BASE.blue, // accent bar + rules
  ink: '#1A1A1A', // body text (print)
  muted: '#6B7280', // secondary text (print)
  line: '#E5E7EB', // hairlines (print)
  paper: BASE.paper,
} as const

export { BRAND_ARGB, COMPANY }

/** The ascending-bars logo mark, redrawn as PDF primitives (SVG assets don't
 * embed cleanly in @react-pdf). */
export function TrailheadMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Rect x="2" y="38" width="10" height="10" rx="2" fill={BRAND.navy} />
      <Rect x="14" y="28" width="10" height="20" rx="2" fill={BRAND.navy} />
      <Rect x="26" y="18" width="10" height="30" rx="2" fill={BRAND.navy} />
      <Rect x="38" y="4" width="10" height="44" rx="2" fill={BRAND.blue} />
    </Svg>
  )
}

const lockup = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { marginLeft: 10, fontSize: 15, fontFamily: 'Helvetica-Bold', color: BRAND.navy },
})

/** Logo mark + company name — the standard document header lockup. */
export function TrailheadLockup({ size = 30 }: { size?: number }) {
  return (
    <View style={lockup.row}>
      <TrailheadMark size={size} />
      <Text style={lockup.name}>{COMPANY.name}</Text>
    </View>
  )
}
