-- Separar visibilidad de catálogo de la propiedad del recurso.
-- Ejecutar en Supabase SQL Editor o con supabase db push.

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS catalog_visibility TEXT NOT NULL DEFAULT 'public';

UPDATE public.resources
SET catalog_visibility = CASE
  WHEN ownership_type = 'personal' THEN 'internal'
  WHEN ownership_type = 'area' THEN 'restricted'
  ELSE 'public'
END
WHERE catalog_visibility IS NULL
   OR catalog_visibility NOT IN ('public', 'restricted', 'internal');

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_catalog_visibility_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_catalog_visibility_check
  CHECK (catalog_visibility IN ('public', 'restricted', 'internal'));

COMMENT ON COLUMN public.resources.catalog_visibility IS
'Controla la exposición del recurso en el catálogo: public, restricted o internal.';

CREATE INDEX IF NOT EXISTS idx_resources_org_visibility
  ON public.resources (organization_id, catalog_visibility);
