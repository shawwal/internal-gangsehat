-- Migration 021: Enrich patient_visits table with clinical data fields
-- Derived from EX. DATA PELAYANAN 2025.xlsx (Kunjungan + TA sheets)

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS service_type text
    CHECK (service_type IN (
      'TERAPI AWAL',
      'PAKET TERAPI',
      'SESI TERAPI',
      'TA VISIT',
      'SESI VISIT',
      'PAKET VISIT',
      'LAINNYA'
    )),
  ADD COLUMN IF NOT EXISTS shift text
    CHECK (shift IN ('PAGI', 'SORE')),
  ADD COLUMN IF NOT EXISTS kehadiran text
    CHECK (kehadiran IN ('HADIR', 'TIDAK HADIR')),
  ADD COLUMN IF NOT EXISTS regio text
    CHECK (regio IN (
      'HEAD', 'NECK', 'SHOULDER', 'UPPER ARM', 'ELBOW', 'LOWER ARM',
      'WRIST', 'HAND', 'SPINE', 'CHEST', 'UPPER BACK', 'LOWER BACK',
      'ABDOMINAL', 'HIP/PELVIC', 'THIGH', 'KNEE', 'CALF', 'ANKLE',
      'FOOT', 'CNS', 'PNS', 'SYSTEMIC', 'CARDIOVASCULAR', 'PULMONAL', 'PERFORMANCE'
    )),
  ADD COLUMN IF NOT EXISTS sumber_pasien text;

-- Notes:
-- `service_type` = LAYANAN in Excel — structured service type replacing free-text `treatment`
--                  Maps from Excel codes: K.TA→TERAPI AWAL, K.ST→SESI TERAPI,
--                  K.PT→PAKET TERAPI, V.TA→TA VISIT, V.ST→SESI VISIT, V.PT→PAKET VISIT
-- `shift`        = PAGI (morning) or SORE (afternoon) — from Excel Kunjungan sheet
-- `kehadiran`    = HADIR/TIDAK HADIR — actual attendance recording by admin
--                  DISTINCT from `status` (scheduled/completed/cancelled/no_show):
--                  `status` is the scheduling workflow state;
--                  `kehadiran` is the literal attendance mark at time of visit
-- `regio`        = body region being treated (REGIO in Excel TA sheet)
--                  26 anatomical regions from the clinic's configuration
-- `sumber_pasien`= patient referral/source (SUMBER PASIEN in Excel TA sheet)
--                  e.g. 'REKOMENDASI ORANG LAIN', 'SOSIAL MEDIA', etc.
--                  Stored as free text to allow flexibility
