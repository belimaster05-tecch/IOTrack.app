-- Fix: organizations SELECT policy was too restrictive (only used profiles.organization_id).
-- This caused the org name to not appear in the sidebar if the active membership's
-- org differed from profiles.organization_id, or if the profile fetch failed.
-- Now it also allows access via any active membership.

DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
USING (
  id IN (
    SELECT profiles.organization_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
  OR
  id IN (
    SELECT om.organization_id
    FROM organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  )
);
