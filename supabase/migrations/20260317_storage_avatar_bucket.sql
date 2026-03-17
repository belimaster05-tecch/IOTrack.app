-- Ensure Avatar bucket exists and is public
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('Avatar', 'Avatar', true,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'], 2097152)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatar_upload_own' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatar_upload_own"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'Avatar' AND name LIKE 'profiles/' || auth.uid()::text || '/%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatar_upload_org_logo' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatar_upload_org_logo"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'Avatar' AND name LIKE 'orgs/%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatar_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatar_public_read"
      ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'Avatar');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatar_update_own' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatar_update_own"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'Avatar' AND name LIKE 'profiles/' || auth.uid()::text || '/%');
  END IF;
END $$;
