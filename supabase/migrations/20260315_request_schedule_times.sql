ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME;

COMMENT ON COLUMN public.requests.start_time IS 'Hora estimada o programada de inicio para la solicitud.';
COMMENT ON COLUMN public.requests.end_time IS 'Hora estimada o programada de cierre o devolucion de la solicitud.';

CREATE INDEX IF NOT EXISTS idx_requests_schedule_window
  ON public.requests (resource_id, needed_from, needed_until, start_time, end_time, status);
