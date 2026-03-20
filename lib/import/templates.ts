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

export const ACCOUNTS_HEADERS = [
  'name',
  'type',
  'industry',
  'email',
  'phone',
  'website',
  'city',
  'country',
  'brands',
]

export const CONTACTS_HEADERS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'job_title',
  'account_name',
  'brands',
]

export const SELL_OUT_TEMPLATE = `${SELL_OUT_HEADERS.join(',')}
Haypp Group,RUSH,RUSH Berry,2024-01,9000,Online,EU,GBP
`

export const ACCOUNTS_TEMPLATE = `${ACCOUNTS_HEADERS.join(',')}
Haypp Group,customer,Retail,info@haypp.com,+44123456789,https://haypp.com,London,UK,"RUSH,BrandX"
`

export const CONTACTS_TEMPLATE = `${CONTACTS_HEADERS.join(',')}
John,Smith,john@haypp.com,+44123456789,Buyer,Haypp Group,"RUSH,BrandX"
`
