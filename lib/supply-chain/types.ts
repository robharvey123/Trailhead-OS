// ============================================================
// Supply Chain Types
// ============================================================

export type InventoryRow = {
  id: string
  workspace_id: string
  product_id: string | null
  variant_id: string | null
  warehouse: string
  qty_on_hand: number
  qty_reserved: number
  qty_available: number
  reorder_point: number
  reorder_qty: number
  unit_cost: number | null
  last_counted_at: string | null
  created_at?: string
  updated_at?: string
  // joined
  product_name?: string
  product_sku?: string
  variant_name?: string
}

export type SupplyOrderStatus = 'pending' | 'confirmed' | 'in_production' | 'shipped' | 'delivered' | 'cancelled'

export type SupplyOrderLineItem = {
  id: string
  product_id?: string
  sku?: string
  description: string
  quantity: number
  unit_cost: number
  total: number
}

export type SupplyOrder = {
  id: string
  workspace_id: string
  order_number: string
  supplier_account_id: string | null
  purchase_order_id: string | null
  status: SupplyOrderStatus
  order_date: string
  expected_date: string | null
  actual_delivery_date: string | null
  line_items: SupplyOrderLineItem[]
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  supplier_name?: string
}

export type ShipmentStatus = 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'lost'

export type ShipmentLineItem = {
  id: string
  product_id?: string
  sku?: string
  description: string
  quantity: number
}

export type Shipment = {
  id: string
  workspace_id: string
  supply_order_id: string | null
  reference_number: string | null
  carrier: string | null
  tracking_number: string | null
  status: ShipmentStatus
  ship_date: string | null
  estimated_delivery: string | null
  actual_delivery: string | null
  origin_address: string | null
  destination_address: string | null
  line_items: ShipmentLineItem[]
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================
// Supply Chain Constants
// ============================================================

export const SUPPLY_ORDER_STATUSES = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'] as const

export const SUPPLY_ORDER_STATUS_LABELS: Record<SupplyOrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const SHIPMENT_STATUSES = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'lost'] as const

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  returned: 'Returned',
  lost: 'Lost',
}

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending: 'text-slate-400',
  picked_up: 'text-blue-400',
  in_transit: 'text-cyan-400',
  out_for_delivery: 'text-amber-400',
  delivered: 'text-emerald-400',
  returned: 'text-rose-400',
  lost: 'text-red-400',
}
