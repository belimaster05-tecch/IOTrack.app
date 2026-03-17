-- Allow authenticated users to update their own profile row.
-- Without this, UPDATE calls from the client (e.g. avatar_url) fail silently due to RLS.
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
