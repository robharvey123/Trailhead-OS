import { Resend } from 'resend'

export const DEFAULT_RESEND_FROM = 'Trailhead OS <notifications@trailheadholdings.uk>'

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null
