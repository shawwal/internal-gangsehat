-- Migration 020: Enrich transactions table with payment details
-- Derived from EX. CATATAN KEUANGAN.xlsx field analysis

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS harga          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding    numeric GENERATED ALWAYS AS
    (GREATEST(harga - amount - discount, 0)) STORED,
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('TUNAI', 'TRANSFER BCA', 'EDC BCA')),
  ADD COLUMN IF NOT EXISTS payment_status text
    CHECK (payment_status IN ('LUNAS', 'DP', 'PELUNASAN')),
  ADD COLUMN IF NOT EXISTS penjamin       text,
  ADD COLUMN IF NOT EXISTS fisio_id       uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL;

-- Index for therapist-based transaction lookups (incentive calculations)
CREATE INDEX IF NOT EXISTS idx_transactions_fisio ON public.transactions(fisio_id);

-- Notes:
-- `amount`         = amount paid by patient (JUMLAH BAYAR in Excel)
-- `harga`          = full price before any payment (HARGA in Excel)
-- `discount`       = discount given (DISKON in Excel)
-- `outstanding`    = computed: max(harga - amount - discount, 0) — KEKURANGAN
-- `payment_method` = TUNAI / TRANSFER BCA / EDC BCA (METODE BAYAR in Excel)
-- `payment_status` = LUNAS / DP / PELUNASAN — payment detail, independent of
--                    the approval `status` column (pending/confirmed/rejected)
-- `penjamin`       = guarantor name — can differ from patient (PENJAMIN in Excel)
-- `fisio_id`       = FK to internal_profiles — treating therapist (FISIO in Excel)
