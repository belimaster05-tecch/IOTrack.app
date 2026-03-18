-- Fix: get_my_context now falls back to auth.users metadata when profile.full_name is null,
-- and handles the case where no profile row exists yet (invited users who skipped setup).
-- Also consolidates org_logo_url which was added in a separate patch.

CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_profile    public.profiles%ROWTYPE;
  v_membership public.organization_memberships%ROWTYPE;
  v_org_name   text;
  v_org_logo   text;
  v_meta_name  text;
  v_meta_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  -- Profile row (may not exist for invited users who haven't set up yet)
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- Always pull auth metadata as fallback source for name + email
  SELECT raw_user_meta_data->>'full_name', email
  INTO v_meta_name, v_meta_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_profile.id IS NULL THEN
    -- No profile row yet: build a minimal skeleton from auth data
    v_profile.id        := v_user_id;
    v_profile.full_name := v_meta_name;
    v_profile.email     := v_meta_email;
  ELSIF v_profile.full_name IS NULL THEN
    -- Profile exists but name was never saved (setup was skipped or failed before RLS fix)
    v_profile.full_name := v_meta_name;
  END IF;

  -- Active membership (default first, then oldest)
  SELECT * INTO v_membership
  FROM public.organization_memberships
  WHERE user_id = v_user_id AND status = 'active'
  ORDER BY is_default DESC, joined_at ASC
  LIMIT 1;

  -- Org name + logo
  IF v_membership.organization_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_org_name, v_org_logo
    FROM public.organizations WHERE id = v_membership.organization_id LIMIT 1;
  ELSIF v_profile.organization_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_org_name, v_org_logo
    FROM public.organizations WHERE id = v_profile.organization_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'profile',      to_jsonb(v_profile),
    'membership',   to_jsonb(v_membership),
    'org_name',     v_org_name,
    'org_logo_url', v_org_logo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
