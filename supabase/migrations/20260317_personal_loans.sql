-- Personal loans: employees can lend their assigned units to colleagues.
-- lender_user_id: the employee who owns/lends the unit (NULL = admin/org loan)
-- notes: optional note on the loan
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_user_id uuid REFERENCES auth.users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS notes text;
