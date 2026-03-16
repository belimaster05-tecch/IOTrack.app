-- Base mínima multitenant: membresías e invitaciones por organización.
-- Mantiene compatibilidad con profiles.organization_id y profiles.role_name mientras el frontend migra.

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT true,
  invited_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_memberships
  DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

ALTER TABLE public.organization_memberships
  ADD CONSTRAINT organization_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'approver', 'member'));

ALTER TABLE public.organization_memberships
  DROP CONSTRAINT IF EXISTS organization_memberships_status_check;

ALTER TABLE public.organization_memberships
  ADD CONSTRAINT organization_memberships_status_check
  CHECK (status IN ('invited', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user
  ON public.organization_memberships (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user
  ON public.organization_memberships (user_id);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  token text NOT NULL UNIQUE,
  invited_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NULL,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('owner', 'admin', 'approver', 'member'));

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_status_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS idx_invitations_org_email
  ON public.invitations (organization_id, email);

INSERT INTO public.organization_memberships (organization_id, user_id, role, status, is_default, joined_at)
SELECT
  p.organization_id,
  p.id,
  CASE
    WHEN p.role_name = 'admin' THEN 'admin'
    WHEN p.role_name = 'approver' THEN 'approver'
    ELSE 'member'
  END,
  'active',
  true,
  now()
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
SET
  role = EXCLUDED.role,
  status = 'active',
  is_default = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_profile_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (organization_id, user_id, role, status, is_default, joined_at)
    VALUES (
      NEW.organization_id,
      NEW.id,
      CASE
        WHEN NEW.role_name = 'admin' THEN 'admin'
        WHEN NEW.role_name = 'approver' THEN 'approver'
        ELSE 'member'
      END,
      'active',
      true,
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET
      role = EXCLUDED.role,
      status = 'active',
      is_default = true,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_membership ON public.profiles;
CREATE TRIGGER trg_sync_profile_membership
AFTER INSERT OR UPDATE OF organization_id, role_name
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_membership();

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT om.organization_id
      FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
      ORDER BY om.is_default DESC, om.joined_at ASC
      LIMIT 1
    ),
    (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_membership_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT om.role
      FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.status = 'active'
      ORDER BY om.is_default DESC, om.joined_at ASC
      LIMIT 1
    ),
    (
      SELECT CASE
        WHEN p.role_name = 'admin' THEN 'admin'
        WHEN p.role_name = 'approver' THEN 'approver'
        ELSE 'member'
      END
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );
$$;

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their memberships" ON public.organization_memberships;
CREATE POLICY "Members can read their memberships"
ON public.organization_memberships
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage memberships in their org" ON public.organization_memberships;
CREATE POLICY "Admins can manage memberships in their org"
ON public.organization_memberships
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_memberships.organization_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_memberships.organization_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can read invitations in their org" ON public.invitations;
CREATE POLICY "Admins can read invitations in their org"
ON public.invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = invitations.organization_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can manage invitations in their org" ON public.invitations;
CREATE POLICY "Admins can manage invitations in their org"
ON public.invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = invitations.organization_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = invitations.organization_id
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  )
);
