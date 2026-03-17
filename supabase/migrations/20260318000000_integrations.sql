-- ========================================
-- Integrations Framework
-- ========================================

-- Provider enum
CREATE TYPE integration_provider AS ENUM (
  'stripe', 'quickbooks', 'xero', 'slack', 'google', 'shopify', 'klaviyo'
);

-- Status enum
CREATE TYPE integration_status AS ENUM (
  'connected', 'disconnected', 'error'
);

-- Sync direction enum
CREATE TYPE sync_direction AS ENUM (
  'inbound', 'outbound'
);

-- Sync status enum
CREATE TYPE sync_status AS ENUM (
  'success', 'failed', 'skipped'
);

-- ========================================
-- workspace_integrations
-- ========================================
CREATE TABLE workspace_integrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider    integration_provider NOT NULL,
  status      integration_status NOT NULL DEFAULT 'disconnected',
  credentials jsonb DEFAULT '{}',
  config      jsonb DEFAULT '{}',
  connected_at timestamptz,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE INDEX idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);

CREATE TRIGGER set_workspace_integrations_updated_at
  BEFORE UPDATE ON workspace_integrations
  FOR EACH ROW EXECUTE FUNCTION update_workspace_updated_at();

-- RLS
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;

-- All workspace members can view integrations
CREATE POLICY "workspace_integrations_select"
  ON workspace_integrations FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Only admins/owners can insert/update/delete integrations
CREATE POLICY "workspace_integrations_insert"
  ON workspace_integrations FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "workspace_integrations_update"
  ON workspace_integrations FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "workspace_integrations_delete"
  ON workspace_integrations FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ========================================
-- integration_sync_log
-- ========================================
CREATE TABLE integration_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  uuid NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
  direction       sync_direction NOT NULL,
  entity_type     text NOT NULL,
  entity_id       text,
  status          sync_status NOT NULL,
  error_message   text,
  records_synced  int DEFAULT 0,
  synced_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_integration ON integration_sync_log(integration_id);
CREATE INDEX idx_sync_log_synced_at ON integration_sync_log(synced_at DESC);

-- RLS
ALTER TABLE integration_sync_log ENABLE ROW LEVEL SECURITY;

-- Members can read sync logs for their workspace integrations
CREATE POLICY "sync_log_select"
  ON integration_sync_log FOR SELECT
  USING (integration_id IN (
    SELECT wi.id FROM workspace_integrations wi
    JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id
    WHERE wm.user_id = auth.uid()
  ));

-- Only admins can insert sync log entries (via service role in practice)
CREATE POLICY "sync_log_insert"
  ON integration_sync_log FOR INSERT
  WITH CHECK (integration_id IN (
    SELECT wi.id FROM workspace_integrations wi
    JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
  ));
