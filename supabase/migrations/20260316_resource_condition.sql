-- Condition tag system: organization-scoped tags for resource condition tracking
-- Visibility: all org members can read
-- Edit rights: admin, owner, approver, department leaders, department managers, location managers

-- ── Helper: returns true if the current user can manage condition tags ─────
CREATE OR REPLACE FUNCTION public.can_manage_condition()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- Admin or owner role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role_name IN ('admin', 'owner', 'approver')
    )
    OR
    -- Department primary leader
    EXISTS (
      SELECT 1 FROM public.departments
      WHERE leader_id = auth.uid()
    )
    OR
    -- Department manager (via managers table)
    EXISTS (
      SELECT 1 FROM public.department_managers
      WHERE user_id = auth.uid()
    )
    OR
    -- Location manager
    EXISTS (
      SELECT 1 FROM public.location_managers
      WHERE user_id = auth.uid()
    )
$$;

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.condition_tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT 'gray',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.resource_condition_tags (
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES public.condition_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- Free-text notes per resource (separate from tags)
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS condition_notes text;

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.condition_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_condition_tags ENABLE ROW LEVEL SECURITY;

-- condition_tags: any org member can READ
CREATE POLICY "members_read_condition_tags"
  ON public.condition_tags FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT organization_id FROM public.organization_memberships
        WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- condition_tags: admins/approvers/managers can CREATE, UPDATE, DELETE
CREATE POLICY "editors_manage_condition_tags"
  ON public.condition_tags FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    AND public.can_manage_condition()
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    AND public.can_manage_condition()
  );

-- resource_condition_tags: any org member can READ
CREATE POLICY "members_read_resource_condition_tags"
  ON public.resource_condition_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.condition_tags ct
      WHERE ct.id = tag_id
        AND ct.organization_id IN (
          SELECT organization_id FROM public.profiles WHERE id = auth.uid()
          UNION
          SELECT organization_id FROM public.organization_memberships
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- resource_condition_tags: admins/approvers/managers can INSERT, DELETE
CREATE POLICY "editors_manage_resource_condition_tags"
  ON public.resource_condition_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.condition_tags ct
      WHERE ct.id = tag_id
        AND ct.organization_id IN (
          SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    AND public.can_manage_condition()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.condition_tags ct
      WHERE ct.id = tag_id
        AND ct.organization_id IN (
          SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    AND public.can_manage_condition()
  );
