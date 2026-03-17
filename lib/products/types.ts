// ============================================================
// Product Types
// ============================================================

export type ProductStatus = 'draft' | 'active' | 'discontinued' | 'archived'
export type LaunchStatus = 'planning' | 'development' | 'testing' | 'ready' | 'launched' | 'cancelled'

export type Product = {
  id: string
  workspace_id: string
  name: string
  sku: string
  brand: string | null
  category: string | null
  description: string | null
  unit_cost: number | null
  unit_price: number | null
  weight_grams: number | null
  status: ProductStatus
  attributes: Record<string, unknown>
  tags: string[]
  image_url: string | null
  barcode: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // computed
  variant_count?: number
  margin?: number | null
}

export type ProductVariant = {
  id: string
  workspace_id: string
  product_id: string
  name: string
  sku: string
  attributes: Record<string, unknown>
  unit_cost: number | null
  unit_price: number | null
  status: 'active' | 'discontinued' | 'archived'
  created_at?: string
  updated_at?: string
}

export type LaunchChecklistItem = {
  id: string
  title: string
  done: boolean
}

export type ProductLaunch = {
  id: string
  workspace_id: string
  product_id: string | null
  title: string
  description: string | null
  launch_date: string | null
  status: LaunchStatus
  checklist: LaunchChecklistItem[]
  assigned_to: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  product_name?: string
}

// ============================================================
// Product Constants
// ============================================================

export const PRODUCT_STATUSES = ['draft', 'active', 'discontinued', 'archived'] as const

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  discontinued: 'Discontinued',
  archived: 'Archived',
}

export const LAUNCH_STATUSES = ['planning', 'development', 'testing', 'ready', 'launched', 'cancelled'] as const

export const LAUNCH_STATUS_LABELS: Record<LaunchStatus, string> = {
  planning: 'Planning',
  development: 'In Development',
  testing: 'Testing',
  ready: 'Ready to Launch',
  launched: 'Launched',
  cancelled: 'Cancelled',
}

export const LAUNCH_STATUS_COLORS: Record<LaunchStatus, string> = {
  planning: 'text-slate-400',
  development: 'text-blue-400',
  testing: 'text-amber-400',
  ready: 'text-cyan-400',
  launched: 'text-emerald-400',
  cancelled: 'text-rose-400',
}
