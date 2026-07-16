-- Run this in the Supabase dashboard > SQL editor
-- The `leave-proofs` bucket was created directly in the dashboard (no tracked
-- migration existed for it). This brings its config under version control and
-- widens the MIME allowlist to cover Android gallery photos (HEIC/HEIF, the
-- non-standard `image/jpg` some OEM gallery providers report) which were
-- previously being silently rejected while fresh camera JPEGs passed fine.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leave-proofs',
  'leave-proofs',
  true,
  5242880,  -- 5 MB, matches the limit advertised in the upload UI
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
