import { Svg, Rect, Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * Shared Trailhead brand for produced documents (invoice, quote, engagement
 * report). Colour tokens match the logo (public/logo.svg): navy bars with a blue
 * accent bar. One place so the PDFs and the XLSX header stay consistent.
 */
export const BRAND = {
  navy: '#0F172A', // logo bars / masthead / headings
  blue: '#0EA5E9', // accent bar + rules
  ink: '#1A1A1A', // body text
  muted: '#6B7280', // secondary text
  line: '#E5E7EB', // hairlines
  paper: '#FFFFFF',
} as const

/** ARGB variants for ExcelJS (FF + hex, no #). */
export const BRAND_ARGB = {
  navy: 'FF0F172A',
  blue: 'FF0EA5E9',
} as const

export const COMPANY = {
  name: 'Trailhead Holdings Ltd',
  number: '16910286',
  registered: 'Registered in England & Wales',
  email: 'rob@trailheadholdings.uk',
} as const

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
