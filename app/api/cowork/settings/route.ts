import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getCompanySettings } from '@/lib/company-settings'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const settings = await getCompanySettings(supabaseService)

    return Response.json({
      company: {
        name: settings.company_name,
        address_line1: settings.address_line1,
        address_line2: settings.address_line2,
        city: settings.city,
        postcode: settings.postcode,
        country: settings.country,
        email: settings.company_email,
        company_number: settings.company_number,
      },
      payment: {
        bank_name: settings.bank_name,
        account_name: settings.bank_account_name,
        sort_code: settings.bank_sort_code,
        account_number: settings.bank_account_number,
        iban: settings.bank_iban,
        bic: settings.bank_bic,
        payment_terms: settings.payment_terms,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to load settings')
  }
}
