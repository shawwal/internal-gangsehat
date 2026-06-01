-- ============================================================
-- Migration 006: allow director (and HR) to delete proof files
-- ============================================================
-- The existing staff_manage_own_proof policy only allows staff
-- to delete files in their own folder. Directors deleting a
-- leave record need to remove files from any staff folder.

CREATE POLICY "director_hr_delete_proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'leave-proofs'
  AND EXISTS (
    SELECT 1 FROM public.internal_profiles
    WHERE id = auth.uid() AND role IN ('director', 'hr')
  )
);
