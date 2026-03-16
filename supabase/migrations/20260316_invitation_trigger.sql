-- Trigger que procesa invitaciones pendientes cuando un usuario inicia sesión por primera vez.
-- Corre en la DB — cero race conditions, cero RLS, cero cliente.

CREATE OR REPLACE FUNCTION public.process_pending_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
BEGIN
  -- Solo actuar en el PRIMER inicio de sesión (last_sign_in_at era NULL)
  IF OLD.last_sign_in_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar invitación pendiente para este email
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Crear membresía
  INSERT INTO public.organization_memberships
    (organization_id, user_id, role, status, is_default, joined_at)
  VALUES
    (v_inv.organization_id, NEW.id, v_inv.role, 'active', true, now())
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', is_default = true;

  -- Actualizar perfil si no tiene organización
  UPDATE public.profiles
  SET
    organization_id = v_inv.organization_id,
    role_name = CASE WHEN v_inv.role = 'member' THEN 'employee' ELSE v_inv.role END
  WHERE id = NEW.id AND organization_id IS NULL;

  -- Marcar invitación como aceptada
  UPDATE public.invitations
  SET accepted_at = now(), status = 'accepted'
  WHERE id = v_inv.id;

  RETURN NEW;
END;
$$;

-- Trigger: solo dispara cuando last_sign_in_at pasa de NULL a un valor (primer sign-in)
DROP TRIGGER IF EXISTS on_first_sign_in_accept_invitation ON auth.users;
CREATE TRIGGER on_first_sign_in_accept_invitation
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL)
  EXECUTE FUNCTION public.process_pending_invitation();
