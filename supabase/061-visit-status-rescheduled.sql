-- Add 'rescheduled' as a valid patient_visits.status value.
-- Needed so the Home Visit "Detail Kunjungan" form can offer a Reschedule
-- status alongside Terjadwal/Selesai/Batal (mockup: Request Home Visit, 16 Agustus 2026).

ALTER TABLE public.patient_visits DROP CONSTRAINT patient_visits_status_check;

ALTER TABLE public.patient_visits ADD CONSTRAINT patient_visits_status_check
  CHECK (status = ANY (ARRAY['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled']));
