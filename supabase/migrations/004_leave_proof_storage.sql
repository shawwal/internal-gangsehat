-- ============================================================
-- Migration 004: leave-proofs storage bucket + RLS
-- ============================================================

-- 1. Create the bucket (public so getPublicUrl() works without signing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leave-proofs',
  'leave-proofs',
  true,
  5242880,  -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Staff can upload into their own folder ({user_id}/*)
CREATE POLICY "staff_upload_own_proof"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'leave-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Staff can delete their own proof files
CREATE POLICY "staff_manage_own_proof"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'leave-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. HR and director can read all proof files
CREATE POLICY "hr_director_read_proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'leave-proofs'
  AND EXISTS (
    SELECT 1 FROM public.internal_profiles
    WHERE id = auth.uid() AND role IN ('hr', 'director')
  )
);

-- 5. Staff can read their own proof files (for preview in leave history)
CREATE POLICY "staff_read_own_proof"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'leave-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
