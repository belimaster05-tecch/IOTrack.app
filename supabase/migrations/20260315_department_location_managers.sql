-- Encargados múltiples para departamentos y ubicaciones
-- Además permite restringir ubicaciones a un departamento específico.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS department_id uuid NULL REFERENCES public.departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.locations.department_id IS
  'Departamento al que se restringe la ubicación cuando aplica (ej. laboratorio o salón de uso interno).';

CREATE TABLE IF NOT EXISTS public.department_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);

COMMENT ON TABLE public.department_managers IS
  'Usuarios encargados de gestionar recursos de un departamento. Pueden coexistir varios por departamento.';

CREATE TABLE IF NOT EXISTS public.location_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, user_id)
);

COMMENT ON TABLE public.location_managers IS
  'Usuarios encargados de gestionar recursos o reservas ligadas a una ubicación concreta.';

INSERT INTO public.department_managers (department_id, user_id, is_primary)
SELECT id, leader_id, true
FROM public.departments
WHERE leader_id IS NOT NULL
ON CONFLICT (department_id, user_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary;

CREATE INDEX IF NOT EXISTS idx_department_managers_department_id ON public.department_managers (department_id);
CREATE INDEX IF NOT EXISTS idx_department_managers_user_id ON public.department_managers (user_id);
CREATE INDEX IF NOT EXISTS idx_location_managers_location_id ON public.location_managers (location_id);
CREATE INDEX IF NOT EXISTS idx_location_managers_user_id ON public.location_managers (user_id);
CREATE INDEX IF NOT EXISTS idx_locations_department_id ON public.locations (department_id);

DROP POLICY IF EXISTS "Department leaders can update requests for their department resources" ON public.requests;

CREATE POLICY "Department and location managers can update requests"
ON public.requests
FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    LEFT JOIN public.departments d ON d.id = r.department_id
    LEFT JOIN public.department_managers dm ON dm.department_id = r.department_id AND dm.user_id = auth.uid()
    LEFT JOIN public.location_managers lm ON lm.location_id = r.location_id AND lm.user_id = auth.uid()
    WHERE r.id = requests.resource_id
      AND (
        d.leader_id = auth.uid()
        OR dm.user_id IS NOT NULL
        OR lm.user_id IS NOT NULL
      )
  )
)
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
