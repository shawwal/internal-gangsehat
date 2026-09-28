-- Sport Massage now has several service types per branch (rows in
-- internal_layanan with kategori = 'SPORT MASSAGE', each with its own harga).
-- Record which one was booked on the visit so the payment dialog can bill
-- the right price instead of guessing the first SPORT MASSAGE row.
--
-- Nullable: only sport massage bookings set it; existing visits stay NULL and
-- fall back to the branch's first active SPORT MASSAGE price.
-- ON DELETE SET NULL: deleting a price-list row must not delete visit history.

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS layanan_id uuid
  REFERENCES public.internal_layanan(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_visits_layanan_id
  ON public.patient_visits(layanan_id)
  WHERE layanan_id IS NOT NULL;
