-- Storage policies for templates and drafts buckets
-- These need to be run AFTER creating the buckets in Supabase Dashboard

-- Templates bucket policies (service role only can upload, anyone authenticated can read)
CREATE POLICY "Service role can upload templates"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'templates');

CREATE POLICY "Service role can update templates"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'templates');

CREATE POLICY "Service role can delete templates"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'templates');

CREATE POLICY "Authenticated users can read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates');

-- Drafts bucket policies (users can only access their own drafts)
CREATE POLICY "Users can upload own drafts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drafts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own drafts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'drafts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own drafts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'drafts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can access all drafts (for cleanup)
CREATE POLICY "Service role can manage all drafts"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'drafts');
