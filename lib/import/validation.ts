import { z } from 'zod'

export const ImportPayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  mode: z.enum(['append', 'replace']),
  rows: z.array(z.record(z.unknown())),
  rowOffset: z.number().int().optional(),
})

export type ImportRejectedRow = {
  row: number
  reason: string
}

export type SellInInsert = {
  workspace_id: string
  customer: string
  country: string | null
  brand: string
  product: string
  date: string
  qty_cans: number
  unit_price: number | null
  total: number | null
  promo_cans: number
}

export type SellOutInsert = {
  workspace_id: string
  company: string
  brand: string
  product: string
  month: string
  units: number
  platform: string | null
  region: string | null
}

const excelEpoch = new Date(Date.UTC(1899, 11, 30))

const normalizeText = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim()

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const normalized = normalizeText(value).replace(/,/g, '')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value: unknown, defaultValue?: number) => {
  const parsed = parseNumber(value)

  if (parsed === null) {
    return defaultValue ?? null
  }

  return Math.round(parsed)
}

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(excelEpoch.getTime() + value * 86400000)
    return toIsoDate(date)
  }

  const text = normalizeText(value)
  if (!text) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
    return text.replace(/\//g, '-')
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    return `${text}-01`
  }

  if (/^\d{4}\/\d{2}$/.test(text)) {
    return `${text.replace(/\//g, '-')}-01`
  }

  return null
}

const parseMonth = (value: unknown) => {
  const date = parseDate(value)
  if (!date) {
    return null
  }

  return `${date.slice(0, 7)}-01`
}

export const validateSellInRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  rowOffset = 1
) => {
  const validRows: SellInInsert[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const customer = normalizeText(row.customer)
    const brand = normalizeText(row.brand)
    const product = normalizeText(row.product)
    const date = parseDate(row.date)
    const qtyCans = parseInteger(row.qty_cans)

    if (!customer) {
      rejected.push({ row: rowNumber, reason: 'Missing customer.' })
      return
    }

    if (!brand) {
      rejected.push({ row: rowNumber, reason: 'Missing brand.' })
      return
    }

    if (!product) {
      rejected.push({ row: rowNumber, reason: 'Missing product.' })
      return
    }

    if (!date) {
      rejected.push({ row: rowNumber, reason: 'Invalid date.' })
      return
    }

    if (qtyCans === null) {
      rejected.push({ row: rowNumber, reason: 'Invalid qty_cans.' })
      return
    }

    const promoCans = parseInteger(row.promo_cans, 0) ?? 0
    const unitPrice = parseNumber(row.unit_price)
    let total = parseNumber(row.total)

    if (total === null && unitPrice !== null) {
      total = unitPrice * qtyCans
    }

    validRows.push({
      workspace_id: workspaceId,
      customer,
      country: normalizeText(row.country) || null,
      brand,
      product,
      date,
      qty_cans: qtyCans,
      unit_price: unitPrice,
      total,
      promo_cans: promoCans,
    })
  })

  return { validRows, rejected }
}

export const validateSellOutRows = (
  rows: Record<string, unknown>[],
  workspaceId: string,
  rowOffset = 1
) => {
  const validRows: SellOutInsert[] = []
  const rejected: ImportRejectedRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = rowOffset + index
    const company = normalizeText(row.company)
    const brand = normalizeText(row.brand)
    const product = normalizeText(row.product)
    const month = parseMonth(row.month)
    const units = parseInteger(row.units)

    if (!company) {
      rejected.push({ row: rowNumber, reason: 'Missing company.' })
      return
    }

    if (!brand) {
      rejected.push({ row: rowNumber, reason: 'Missing brand.' })
      return
    }

    if (!product) {
      rejected.push({ row: rowNumber, reason: 'Missing product.' })
      return
    }

    if (!month) {
      rejected.push({ row: rowNumber, reason: 'Invalid month.' })
      return
    }

    if (units === null) {
      rejected.push({ row: rowNumber, reason: 'Invalid units.' })
      return
    }

    validRows.push({
      workspace_id: workspaceId,
      company,
      brand,
      product,
      month,
      units,
      platform: normalizeText(row.platform) || null,
      region: normalizeText(row.region) || null,
    })
  })

  return { validRows, rejected }
}
