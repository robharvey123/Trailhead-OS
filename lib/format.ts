export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export const formatCurrency = (value: number, symbol: string) =>
  `${symbol}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`

export const formatPercent = (value: number) =>
  `${value.toFixed(1)}%`
