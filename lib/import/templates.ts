export const SELL_IN_HEADERS = [
  'customer',
  'country',
  'brand',
  'product',
  'date',
  'qty_cans',
  'unit_price',
  'total',
  'promo_cans',
  'currency',
]

export const SELL_OUT_HEADERS = [
  'company',
  'brand',
  'product',
  'month',
  'units',
  'platform',
  'region',
  'currency',
]

export const SELL_IN_TEMPLATE = `${SELL_IN_HEADERS.join(',')}
Haypp Dach,DE,RUSH,RUSH Berry,2024-01-15,12000,0.85,10200,500,GBP
`

export const SELL_OUT_TEMPLATE = `${SELL_OUT_HEADERS.join(',')}
Haypp Group,RUSH,RUSH Berry,2024-01,9000,Online,EU,GBP
`
