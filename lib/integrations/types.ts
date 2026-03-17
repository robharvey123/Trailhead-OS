// Integration provider identifiers
export const PROVIDERS = [
  'stripe', 'quickbooks', 'xero', 'slack', 'google', 'shopify', 'klaviyo',
] as const

export type IntegrationProvider = (typeof PROVIDERS)[number]
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'
export type SyncDirection = 'inbound' | 'outbound'
export type SyncStatus = 'success' | 'failed' | 'skipped'

export interface WorkspaceIntegration {
  id: string
  workspace_id: string
  provider: IntegrationProvider
  status: IntegrationStatus
  config: Record<string, unknown>
  connected_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
}

export interface SyncLogEntry {
  id: string
  integration_id: string
  direction: SyncDirection
  entity_type: string
  entity_id: string | null
  status: SyncStatus
  error_message: string | null
  records_synced: number
  synced_at: string
}
