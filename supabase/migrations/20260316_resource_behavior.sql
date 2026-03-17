-- Add behavior column to resources
-- behavior = how the resource behaves (prestable, instalado, servicio)
-- type    = how stock is tracked (reusable = serialized units, consumable = bulk)

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS behavior text NOT NULL DEFAULT 'prestable';

-- Migrate old type values: 'instalado' and 'servicio' were mixed into 'type'.
-- Separate them: type stays as tracking mode, behavior carries the behavioural meaning.
UPDATE public.resources SET type = 'reusable',   behavior = 'instalado' WHERE type = 'instalado';
UPDATE public.resources SET type = 'consumable', behavior = 'servicio'  WHERE type = 'servicio';

-- Add a check constraint so only valid values are stored
ALTER TABLE public.resources ADD CONSTRAINT resources_behavior_check
  CHECK (behavior IN ('prestable', 'instalado', 'servicio'));

ALTER TABLE public.resources ADD CONSTRAINT resources_type_check
  CHECK (type IN ('reusable', 'consumable'));
