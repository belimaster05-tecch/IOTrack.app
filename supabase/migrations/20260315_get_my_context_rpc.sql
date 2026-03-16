-- RPC: get_my_context()
-- Returns the current user's profile + active membership + org name in one call.
-- Runs as SECURITY DEFINER (function owner = postgres superuser), bypassing RLS entirely.
-- This eliminates the silent query failure that occurs when auth.uid() is not attached
-- to the request JWT during the brief race condition after login.

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
  v_org_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- Active membership (default first, then oldest)
  SELECT * INTO v_membership
  FROM public.organization_memberships
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY is_default DESC, joined_at ASC
  LIMIT 1;

  -- Org name
  IF v_membership.organization_id IS NOT NULL THEN
    SELECT name INTO v_org_name FROM public.organizations WHERE id = v_membership.organization_id LIMIT 1;
  ELSIF v_profile.organization_id IS NOT NULL THEN
    SELECT name INTO v_org_name FROM public.organizations WHERE id = v_profile.organization_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'membership', to_jsonb(v_membership),
    'org_name', v_org_name
  );
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
