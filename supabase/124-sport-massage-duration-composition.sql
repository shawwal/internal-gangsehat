-- 124 — Sport Massage: service duration + package composition
--
-- Duration. A Full Body massage takes 90 minutes, but the schedule grid is
-- hourly, so admins booked two visits (19:00 + a 20:00 placeholder) for one
-- massage. Each Layanan now has a duration and each visit stores its own
-- (copied at booking): a 90-minute visit is one visit, one package session,
-- one payroll count; the grid shows the 30-minute overhang and the next
-- booking can start at :30. createVisit/updateVisit reject Sport Massage
-- bookings that overlap the therapist's other visits.
--
-- Composition. A package Layanan can list the session Layanan it contains
-- ({session_layanan_id: count}). Booking from such a package, the admin picks
-- which session this visit is; that session Layanan is stored as the visit's
-- layanan_id, so payroll (SPORT_MASSAGE_FULL_BODY / _SEGMENTAL match on
-- layanan) counts Combo sessions too — package visits with a layanan_id are
-- resolved by it before the package's own Layanan.

ALTER TABLE public.internal_layanan
  ADD COLUMN IF NOT EXISTS durasi_menit integer NOT NULL DEFAULT 60
    CHECK (durasi_menit BETWEEN 15 AND 240),
  ADD COLUMN IF NOT EXISTS paket_komposisi jsonb;

COMMENT ON COLUMN public.internal_layanan.durasi_menit IS
  'Minutes one session takes on the schedule (Sport Massage Full Body = 90).';
COMMENT ON COLUMN public.internal_layanan.paket_komposisi IS
  'Package contents {session_layanan_id: count}; NULL = not itemised.';

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS duration_minutes integer
    CHECK (duration_minutes BETWEEN 15 AND 240);

COMMENT ON COLUMN public.patient_visits.duration_minutes IS
  'Minutes the visit occupies the therapist; NULL = 60.';

-- Full Body clinic sessions take 90 minutes.
UPDATE public.internal_layanan
SET durasi_menit = 90
WHERE kategori = 'SPORT MASSAGE'
  AND nama ~* 'full\s*body'
  AND nama !~* 'visit';

-- Pontianak packages, from their descriptions / session counts.
WITH s AS (
  SELECT
    (SELECT id FROM public.internal_layanan
      WHERE branch_id = 'cfe27e13-ba0b-440d-99f3-03e059efb877' AND kategori = 'SPORT MASSAGE'
        AND nama = 'Sesi Full Body Sports Massage') AS fb,
    (SELECT id FROM public.internal_layanan
      WHERE branch_id = 'cfe27e13-ba0b-440d-99f3-03e059efb877' AND kategori = 'SPORT MASSAGE'
        AND nama = 'Sesi Segmental Sports Massage') AS seg
)
UPDATE public.internal_layanan l
SET paket_komposisi = v.komposisi, jumlah_sesi = v.total
FROM s, LATERAL (VALUES
  ('Paket Full Body Sports Massage', jsonb_build_object(s.fb::text, 3), 3),
  ('Paket Segmental Sports Massage', jsonb_build_object(s.seg::text, 4), 4),
  ('Paket Combo 1 Sports Massage',   jsonb_build_object(s.fb::text, 2, s.seg::text, 1), 3),
  ('Paket Combo 2 Sports Massage',   jsonb_build_object(s.fb::text, 1, s.seg::text, 3), 4)
) AS v(nama, komposisi, total)
WHERE l.branch_id = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
  AND l.kategori = 'PAKET SPORT MASSAGE'
  AND l.nama = v.nama
  AND s.fb IS NOT NULL AND s.seg IS NOT NULL;

-- Package visits whose package is single-kind get that session Layanan and its
-- duration, so they render and count like new bookings.
UPDATE public.patient_visits v
SET layanan_id = (SELECT k.key::uuid FROM jsonb_each(l.paket_komposisi) k LIMIT 1),
    updated_at = now()
FROM public.patient_packages pp
JOIN public.internal_layanan l ON l.id = pp.layanan_id
WHERE v.package_id = pp.id
  AND v.service_type = 'SPORT MASSAGE'
  AND (v.layanan_id IS NULL OR v.layanan_id = pp.layanan_id)
  AND l.paket_komposisi IS NOT NULL
  AND (SELECT count(*) FROM jsonb_object_keys(l.paket_komposisi)) = 1;

NOTIFY pgrst, 'reload schema';
