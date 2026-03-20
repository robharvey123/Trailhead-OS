-- ============================================================
-- Global CRM: brands column, cross-workspace RLS, invoice auto-number
-- ============================================================

-- 1. Add brands column to CRM tables
ALTER TABLE crm_accounts ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}';
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS brands text[] NOT NULL DEFAULT '{}';

-- 2. Index for linked_workspace_id lookups (reverse direction)
CREATE INDEX IF NOT EXISTS idx_workspace_links_linked ON workspace_links(linked_workspace_id);

-- 3. GIN indexes for brands array lookups
CREATE INDEX IF NOT EXISTS idx_crm_accounts_brands ON crm_accounts USING gin(brands);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_brands ON crm_contacts USING gin(brands);

-- 4. Update CRM RLS policies — allow access from linked workspaces
--    If user is member of workspace B, and workspace_links(A, B) exists,
--    user can access CRM data in workspace A.

DROP POLICY IF EXISTS crm_accounts_member ON crm_accounts;
CREATE POLICY crm_accounts_member ON crm_accounts FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS crm_contacts_member ON crm_contacts;
CREATE POLICY crm_contacts_member ON crm_contacts FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS crm_deals_member ON crm_deals;
CREATE POLICY crm_deals_member ON crm_deals FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS crm_activities_member ON crm_activities;
CREATE POLICY crm_activities_member ON crm_activities FOR ALL
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR workspace_id IN (
      SELECT wl.workspace_id FROM workspace_links wl
      WHERE wl.linked_workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
