-- Add features JSONB column to organizations for per-org feature flags
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}';

-- Allow org admins to update features (they can already UPDATE their org via existing policy)
-- No extra policy needed — existing "owner/admin can manage org" covers UPDATE.

-- Verify with: SELECT id, name, features FROM organizations;
