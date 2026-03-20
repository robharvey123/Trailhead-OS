export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  SEK: 'kr',
  CHF: 'CHF',
  NOK: 'kr',
  DKK: 'kr',
}

export const currencySymbol = (code: string) =>
  CURRENCY_SYMBOLS[code.toUpperCase()] ?? code

export const formatCurrency = (value: number, symbolOrCode: string) => {
  const sym = symbolOrCode.length <= 3 && /^[A-Z]{3}$/i.test(symbolOrCode)
    ? currencySymbol(symbolOrCode)
    : symbolOrCode
  return `${sym}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`
}

export const formatCurrencyWithCode = (value: number, code: string) =>
  `${currencySymbol(code)}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${code}`

export const formatPercent = (value: number) =>
  `${value.toFixed(1)}%`

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export const formatMonthLabel = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) {
    return value
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = match[3] ? Number(match[3]) : 1
  const date = new Date(Date.UTC(year, month - 1, day))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return monthFormatter.format(date).replace(/\s+/g, '-')
}
