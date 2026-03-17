import { createAdminClient } from '@/lib/supabase/admin'
import type { SyncDirection, SyncStatus } from './types'

interface LogSyncParams {
  integrationId: string
  direction: SyncDirection
  entityType: string
  entityId?: string
  status: SyncStatus
  errorMessage?: string
  recordsSynced?: number
}

export async function logSync({
  integrationId, direction, entityType, entityId, status, errorMessage, recordsSynced = 0,
}: LogSyncParams) {
  const supabase = createAdminClient()
  await supabase.from('integration_sync_log').insert({
    integration_id: integrationId,
    direction,
    entity_type: entityType,
    entity_id: entityId ?? null,
    status,
    error_message: errorMessage ?? null,
    records_synced: recordsSynced,
  })
}

export async function getLastSync(integrationId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('integration_sync_log')
    .select('*')
    .eq('integration_id', integrationId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getSyncHistory(integrationId: string, limit = 20) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('integration_sync_log')
    .select('*')
    .eq('integration_id', integrationId)
    .order('synced_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
