-- Run this in the Supabase dashboard > SQL editor
-- Payment proof (bukti transfer) uploads for non-cash payments:
--   * transactions.receipt_url        — already in the schema, now used: object path
--                                       inside the private `payment-proofs` bucket
--   * booking_payments.proof_path     — same, for order "Detail Bayar" payments
-- The UI resolves paths to short-lived signed URLs (bank receipts must not be public).

ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS proof_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  2097152,  -- 2 MB cap on the compressed file
  ARRAY['image/webp']  -- client compresses every upload to WebP (PaymentProofField)
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Any active internal user may read/upload (booking_payments is writable by all
-- internal staff — migration 089); row-level access to the payment itself is
-- still enforced by transactions / booking_payments RLS, and paths are random.
DROP POLICY IF EXISTS "payment_proofs_select" ON storage.objects;
CREATE POLICY "payment_proofs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.get_my_internal_role() IS NOT NULL);

DROP POLICY IF EXISTS "payment_proofs_insert" ON storage.objects;
CREATE POLICY "payment_proofs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND public.get_my_internal_role() IS NOT NULL);

-- Deleting proofs is limited to roles that manage payments.
DROP POLICY IF EXISTS "payment_proofs_delete" ON storage.objects;
CREATE POLICY "payment_proofs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.get_my_internal_role() IN ('director', 'manager', 'finance', 'admin')
  );
