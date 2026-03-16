-- Migración: RLS para encargados de departamento + fechas en requests
-- Ejecutar en el SQL Editor de Supabase (proyecto InvTrack) o con supabase db push

-- 1) Columnas opcionales de fechas de uso en requests (evita depender solo de notes)
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS needed_from DATE,
  ADD COLUMN IF NOT EXISTS needed_until DATE;

COMMENT ON COLUMN public.requests.needed_from IS 'Fecha (inicio) de uso solicitada.';
COMMENT ON COLUMN public.requests.needed_until IS 'Fecha (fin) de uso solicitada.';

-- 2) RLS: permitir que encargados de departamento aprueben/rechacen solicitudes de recursos de su departamento
-- Sin esta política, los usuarios con rol employee que son leader_id en departments no pueden hacer UPDATE en requests.
CREATE POLICY "Department leaders can update requests for their department resources"
ON public.requests
FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.resources r
    INNER JOIN public.departments d ON d.id = r.department_id AND d.leader_id = auth.uid()
    WHERE r.id = requests.resource_id
  )
)
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 3) Índices recomendados para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_requests_org_status ON public.requests (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_resource_id ON public.requests (resource_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON public.loans (user_id, status);
CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON public.departments (leader_id);
