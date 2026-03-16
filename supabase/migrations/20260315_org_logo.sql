-- Add logo_url to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

-- Update get_my_context() RPC to include logo_url
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile  public.profiles%ROWTYPE;
  v_membership public.organization_memberships%ROWTYPE;
  v_org record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id LIMIT 1;

  SELECT * INTO v_membership
  FROM public.organization_memberships
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY is_default DESC, joined_at ASC
  LIMIT 1;

  IF v_membership.organization_id IS NOT NULL THEN
    SELECT id, name, logo_url INTO v_org FROM public.organizations WHERE id = v_membership.organization_id LIMIT 1;
  ELSIF v_profile.organization_id IS NOT NULL THEN
    SELECT id, name, logo_url INTO v_org FROM public.organizations WHERE id = v_profile.organization_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'membership', to_jsonb(v_membership),
    'org_name', v_org.name,
    'org_logo_url', v_org.logo_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
