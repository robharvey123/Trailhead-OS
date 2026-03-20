-- Add workspace type to distinguish brand vs holding workspaces
ALTER TABLE workspaces
  ADD COLUMN type text NOT NULL DEFAULT 'brand'
  CHECK (type IN ('brand', 'holding'));
