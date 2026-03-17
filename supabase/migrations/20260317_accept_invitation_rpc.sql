CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv   record;
  v_user  uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  SELECT i.*, o.name AS org_name INTO v_inv
  FROM invitations i JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_accepted', 'org_name', v_inv.org_name); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('error', 'expired'); END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch'); END IF;

  -- Crear membresía (idempotente — el trigger puede haberla creado ya)
  INSERT INTO organization_memberships (organization_id, user_id, role, status, is_default, joined_at)
  VALUES (v_inv.organization_id, v_user, v_inv.role, 'active', true, now())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

  UPDATE profiles
  SET organization_id = v_inv.organization_id,
      role_name = CASE WHEN v_inv.role = 'member' THEN 'employee' ELSE v_inv.role END
  WHERE id = v_user AND organization_id IS NULL;

  UPDATE invitations SET accepted_at = now(), status = 'accepted'
  WHERE id = v_inv.id AND accepted_at IS NULL;

  RETURN jsonb_build_object('org_name', v_inv.org_name);
END;
$$;
