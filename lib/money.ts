/**
 * Single money formatter + the supported-currency allow-list for OS invoicing.
 *
 * This deliberately hardcodes the currency set rather than reading
 * workspace_settings.supported_currencies — that table belongs to the
 * multi-tenant workspace product and the OS invoicing surface has no workspace.
 */

export const SUPPORTED_CURRENCIES = ['GBP', 'EUR', 'USD', 'SEK', 'CHF', 'NOK', 'DKK'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/** Format an amount in its own currency, e.g. £3,500.00 / $4,718.35.
 * narrowSymbol keeps USD as "$" (not "US$") so the symbol matches the currency. */
export function formatMoney(value: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
