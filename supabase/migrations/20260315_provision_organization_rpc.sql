-- RPC para provisionamiento seguro de organización desde el cliente.
-- Corre como SECURITY DEFINER para evitar que el cliente toque las tablas directamente
-- con privilegios elevados durante el registro inicial.

CREATE OR REPLACE FUNCTION public.provision_organization(
  p_full_name text,
  p_org_name  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Verificar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Evitar doble provisión: si ya tiene org, devolver la existente
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- Crear la organización
  INSERT INTO public.organizations (name)
  VALUES (trim(p_org_name))
  RETURNING id INTO v_org_id;

  -- Actualizar/crear perfil con org y rol admin
  INSERT INTO public.profiles (id, full_name, organization_id, role_name)
  VALUES (auth.uid(), trim(p_full_name), v_org_id, 'admin')
  ON CONFLICT (id) DO UPDATE
    SET full_name       = trim(p_full_name),
        organization_id = v_org_id,
        role_name       = 'admin',
        updated_at      = now();

  -- Crear membresía como owner
  INSERT INTO public.organization_memberships
    (organization_id, user_id, role, status, is_default, joined_at)
  VALUES
    (v_org_id, auth.uid(), 'owner', 'active', true, now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role       = 'owner',
        status     = 'active',
        is_default = true,
        updated_at = now();

  RETURN v_org_id;
END;
$$;

-- Solo usuarios autenticados pueden llamar esta función
REVOKE ALL ON FUNCTION public.provision_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text) TO authenticated;
