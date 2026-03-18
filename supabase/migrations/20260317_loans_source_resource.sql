-- Track how a loan was created:
--   'request'   = created via formal approval flow (default, backcompat)
--   'personal'  = employee lending their assigned unit to a colleague
--   'quick_log' = direct usage registration without approval
ALTER TABLE loans ADD COLUMN IF NOT EXISTS source text DEFAULT 'request'
  CHECK (source IN ('request', 'personal', 'quick_log'));

-- Direct resource reference — useful when no unit is tracked (non-serialized resources)
-- Also backfilled for all existing loans so resource is always derivable.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS resource_id uuid
  REFERENCES public.resources(id) ON DELETE SET NULL;

-- Backfill resource_id from the unit's parent resource
UPDATE loans
SET resource_id = ru.resource_id
FROM resource_units ru
WHERE loans.unit_id = ru.id
  AND loans.resource_id IS NULL;

-- Mark existing personal loans
UPDATE loans
SET source = 'personal'
WHERE lender_user_id IS NOT NULL
  AND source = 'request';
