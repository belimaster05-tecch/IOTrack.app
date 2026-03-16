-- RLS para tabla barcodes: solo ver/gestionar códigos de recursos de la propia organización
ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barcodes_select_org" ON public.barcodes FOR SELECT USING (
  (resource_id IS NOT NULL AND resource_id IN (
    SELECT id FROM public.resources WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
  OR (unit_id IS NOT NULL AND unit_id IN (
    SELECT ru.id FROM public.resource_units ru
    JOIN public.resources r ON r.id = ru.resource_id
    WHERE r.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
);

CREATE POLICY "barcodes_insert_org" ON public.barcodes FOR INSERT WITH CHECK (
  (resource_id IS NOT NULL AND resource_id IN (
    SELECT id FROM public.resources WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
  OR (unit_id IS NOT NULL AND unit_id IN (
    SELECT ru.id FROM public.resource_units ru
    JOIN public.resources r ON r.id = ru.resource_id
    WHERE r.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
);

CREATE POLICY "barcodes_delete_org" ON public.barcodes FOR DELETE USING (
  (resource_id IS NOT NULL AND resource_id IN (
    SELECT id FROM public.resources WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
  OR (unit_id IS NOT NULL AND unit_id IN (
    SELECT ru.id FROM public.resource_units ru
    JOIN public.resources r ON r.id = ru.resource_id
    WHERE r.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  ))
);
