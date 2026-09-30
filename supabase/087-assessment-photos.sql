-- Run this in the Supabase dashboard > SQL editor
-- Terapi Awal assessment photo uploads:
--   * pemeriksaan_penunjang_paths — supporting exam photos (X-ray, MRI, lab…), up to 10
--   * informed_consent_path       — signed informed-consent photo, exactly one
-- Columns store object paths inside the private `assessment-photos` bucket;
-- the UI resolves them to short-lived signed URLs (medical images must not be public).

ALTER TABLE public.terapi_awal_assessments
  ADD COLUMN IF NOT EXISTS pemeriksaan_penunjang_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS informed_consent_path text;

ALTER TABLE public.terapi_awal_assessments
  DROP CONSTRAINT IF EXISTS taa_pemeriksaan_penunjang_max_10;
ALTER TABLE public.terapi_awal_assessments
  ADD CONSTRAINT taa_pemeriksaan_penunjang_max_10
  CHECK (coalesce(array_length(pemeriksaan_penunjang_paths, 1), 0) <= 10);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-photos',
  'assessment-photos',
  false,
  5242880,  -- 5 MB cap on the compressed file
  ARRAY['image/webp']  -- client compresses every upload to WebP (PhotoUploadField)
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Any active internal user may read/write; row-level access to the assessment
-- itself is still enforced by terapi_awal_assessments RLS.
DROP POLICY IF EXISTS "assessment_photos_select" ON storage.objects;
CREATE POLICY "assessment_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assessment-photos' AND public.get_my_internal_role() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_photos_insert" ON storage.objects;
CREATE POLICY "assessment_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessment-photos' AND public.get_my_internal_role() IS NOT NULL);

DROP POLICY IF EXISTS "assessment_photos_delete" ON storage.objects;
CREATE POLICY "assessment_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assessment-photos' AND public.get_my_internal_role() IS NOT NULL);
