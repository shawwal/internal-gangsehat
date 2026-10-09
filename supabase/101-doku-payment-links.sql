-- Run this in the Supabase dashboard > SQL editor
-- DOKU online payment links (QRIS / Virtual Account) — see lib/doku/.
--   * payment_links           — one row per DOKU Checkout link an admin generates;
--                               settled by the webhook (/api/payments/doku/notify)
--                               or by polling the DOKU status API.
--   * transactions             — new payment methods 'DOKU QRIS' / 'DOKU VA'; a paid
--                               link inserts one auto-confirmed income row.
--   * payment-receipts bucket  — private; server-generated PDF receipt per paid link
--                               (transactions.receipt_url = object path "doku/YYYY/MM/<invoice>.pdf").

CREATE TABLE IF NOT EXISTS public.payment_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  branch_id           uuid NOT NULL REFERENCES public.branches(id),
  patient_id          uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  visit_id            uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  order_id            text,
  transaction_id      uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  method              text NOT NULL CHECK (method IN ('QRIS', 'VA')),
  amount              numeric NOT NULL CHECK (amount > 0),
  harga               numeric NOT NULL DEFAULT 0,
  discount            numeric NOT NULL DEFAULT 0,
  category            text NOT NULL,
  description         text,
  customer_name       text NOT NULL,
  customer_phone      text,
  customer_email      text,
  invoice_number      text NOT NULL UNIQUE,
  checkout_url        text,
  environment         text NOT NULL CHECK (environment IN ('development', 'production')),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'expired', 'failed', 'cancelled')),
  expires_at          timestamptz NOT NULL,
  sent_at             timestamptz,
  sent_via            text CHECK (sent_via IN ('whatsapp', 'copy', 'screen')),
  opened_on_screen_at timestamptz,
  paid_at             timestamptz,
  payment_channel     text,
  doku_reference      text,
  receipt_path        text,
  raw_status          jsonb,
  last_notification   jsonb,
  created_by          uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payment_links_branch_created_idx ON public.payment_links (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_links_patient_idx ON public.payment_links (patient_id);
CREATE INDEX IF NOT EXISTS payment_links_pending_idx ON public.payment_links (status) WHERE status = 'pending';

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_links_director_all" ON public.payment_links;
CREATE POLICY "payment_links_director_all" ON public.payment_links FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- Same branch-scoped payment roles as transactions (finance / manager / admin).
DROP POLICY IF EXISTS "payment_links_branch_roles" ON public.payment_links;
CREATE POLICY "payment_links_branch_roles" ON public.payment_links FOR ALL
  USING (
    get_my_internal_role() IN ('finance', 'manager', 'admin')
    AND branch_id = get_my_branch()
  )
  WITH CHECK (
    get_my_internal_role() IN ('finance', 'manager', 'admin')
    AND branch_id = get_my_branch()
  );

-- ── transactions: gateway payment methods ────────────────────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'TUNAI'::text, 'TRANSFER BCA'::text, 'EDC BCA'::text, 'TRANSFER BANK KALBAR'::text,
    'DOKU QRIS'::text, 'DOKU VA'::text
  ]));

-- ── payment-receipts bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 1048576, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Receipts are written only by the server (service role); internal users read
-- them like payment proofs (row access is enforced on transactions/payment_links).
DROP POLICY IF EXISTS "payment_receipts_select" ON storage.objects;
CREATE POLICY "payment_receipts_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.get_my_internal_role() IS NOT NULL);
