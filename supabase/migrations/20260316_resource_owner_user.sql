-- Link personal-assigned resources to a specific user (uuid FK).
-- Needed for row-level visibility: assigned user can see their own restricted resources.

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_owner_user_id ON public.resources(owner_user_id);
