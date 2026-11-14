/**
 * Trailhead brand constants (Brand Guidelines v1.0), for everything that
 * cannot read CSS custom properties: PDFs, spreadsheets and email HTML.
 *
 * The web reads the same values as tokens in app/globals.css (.thmock) and
 * app/(marketing)/bay.css (.bay-plan). Keep the three in step.
 */
export const BRAND = {
  navy: '#0F172A', // logo bars, mastheads, headings, primary type
  navyDeep: '#0B1120',
  blue: '#0EA5E9', // the one accent: rules, buttons, the tallest logo bar
  blueBright: '#38BDF8', // blue on navy
  blueInk: '#0369A1', // blue as type on white, 5.93:1
  slate: '#64748B', // captions and secondary lines on white, 4.76:1
  body: '#334155', // body copy, 10.35:1 on white
  border: '#E2E8F0', // hairlines
  coolLight: '#F8FAFC', // page ground behind white
  paper: '#FFFFFF',
  orange: '#F97316', // at most once per page
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

/** Font stack for email HTML. Inter where the client has it, then system sans. */
export const EMAIL_FONT = "Inter, -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif"
