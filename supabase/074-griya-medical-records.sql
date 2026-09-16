-- Migration: Griya Anak's own medical records (Terapi Awal intake + per-session SOAP)
-- Run this in the Supabase SQL editor, after 073.
--
-- Griya Anak (pediatric sensory-integration therapy) previously had no clinical
-- record tables of its own: lib/visitRouting.ts routed its TERAPI AWAL visits into
-- the adult MSK guided assessment (terapi_awal_assessments — SOCRATES/ROM/MMT/ICF,
-- all adult-specific) and its SESI/PAKET TERAPI visits into the adult session_notes
-- SOAP form. Neither fits a child's sensory-integration record. These two new
-- tables are Griya Anak's own equivalents, additive-only, structurally mirroring
-- 031-terapi-awal-assessments.sql / 033-session-notes.sql (1:1 with a patient_visits
-- row via visit_id UNIQUE, draft/completed status, same RLS shape).

-- ── griya_terapi_awal ───────────────────────────────────────────────────────────
-- One row per Griya Anak TERAPI AWAL patient_visits row. Content mirrors the
-- paper "REKAM MEDIS SENSORI INTEGRASI" intake form. Identity/contact fields
-- (name, parents, address, agama, sumber, hobi, keluhan) already live on
-- patients (see 073-griya-anak-student-fields.sql) via StudentFormFields — this
-- table only holds the clinical intake content that form doesn't cover.

CREATE TABLE IF NOT EXISTS public.griya_terapi_awal (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL UNIQUE REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id   uuid NOT NULL REFERENCES public.patients(id),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Riwayat Keluarga
  riwayat_keluarga        text,

  -- Riwayat Kehamilan
  usia_ibu_hamil          text,
  keluhan_ibu_hamil       text,

  -- Riwayat Kelahiran
  usia_kehamilan_lahir    text,
  jumlah_hamil            text,
  jumlah_melahirkan       text,
  cara_lahir              text CHECK (cara_lahir IN ('CESAR', 'NORMAL')),
  tempat_lahir            text,
  induksi                 text,
  nicu                    text,
  inkubator               text,
  berat_badan_lahir       text,
  panjang_badan_lahir     text,
  kondisi_khusus_lahir    text,
  langsung_menangis       text,

  -- Masa Pertumbuhan dan Perkembangan
  berat_badan             text,
  tinggi_badan            text,
  lingkar_kepala          text,
  usia_merayap            text,
  usia_merangkak          text,
  usia_duduk_mandiri      text,
  usia_merambat           text,
  usia_berjalan           text,
  usia_menunjuk           text,
  usia_babbling           text,
  usia_mengucap_kata      text,
  toilet_training         text,
  pertumbuhan_lainnya     text,

  -- Riwayat Sakit/Keluhan
  riwayat_sakit           text,

  -- Interaksi Antar Personal
  aktivitas_dirumah       text,
  aktivitas_diluar_rumah  text,
  kepribadian_anak        text,
  tipe_sosialisasi        text,
  hobi_anak               text,

  -- Masalah Wicara / Oral Motor
  kemampuan_menyedot         text,
  kemampuan_sikat_gigi       text,
  kemampuan_menghisap_pipet  text,
  kemampuan_meniup_lilin     text,
  kemampuan_kontrol_liur     text,
  kemampuan_mengunyah        text,
  kemampuan_makan            text,
  bentuk_tekstur_makanan     text,
  wicara_lainnya             text,

  -- Pemeriksaan Objektif/Penunjang
  kontak_mata             text,
  kemampuan_duduk_tenang  text,

  -- Diagnosa (dari Assessor)
  diagnosa                text,

  -- Program Rencana Terapi
  fisioterapi_motorik     text,
  fisioterapi_sensorik    text,
  terapi_wicara           text,
  terapi_okupasi          text,
  terapi_perilaku         text,

  -- Target & Program Terapi
  target_program_terapi   text,

  -- Jadwal Terapi
  jadwal_hari             text,
  jadwal_pukul            text,

  -- Assessor sign-off
  assessor_si_id          uuid REFERENCES public.internal_profiles(id),
  assessor_si_tanggal     date,
  assessor_wicara_id      uuid REFERENCES public.internal_profiles(id),
  assessor_wicara_tanggal date
);

CREATE INDEX IF NOT EXISTS idx_gta_branch_id  ON public.griya_terapi_awal(branch_id);
CREATE INDEX IF NOT EXISTS idx_gta_patient_id ON public.griya_terapi_awal(patient_id);

DROP TRIGGER IF EXISTS griya_terapi_awal_updated_at ON public.griya_terapi_awal;
CREATE TRIGGER griya_terapi_awal_updated_at BEFORE UPDATE ON public.griya_terapi_awal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.griya_terapi_awal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gta_director_all" ON public.griya_terapi_awal FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "gta_branch_staff_all" ON public.griya_terapi_awal FOR ALL
USING (branch_id = get_my_branch())
WITH CHECK (branch_id = get_my_branch());

-- ── griya_session_notes ─────────────────────────────────────────────────────────
-- One row per Griya Anak follow-up (SESI/PAKET TERAPI) patient_visits row — the
-- compact per-meeting SOAP note ("Periksa Pertemuan Ke-N"). "Pertemuan ke-N" is
-- deliberately not stored here: it's derived at read time from the visit's
-- position among patient_visits sharing the same griya_slot_id, same as package
-- session numbering elsewhere in the app.

CREATE TABLE IF NOT EXISTS public.griya_session_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL UNIQUE REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id   uuid NOT NULL REFERENCES public.patients(id),
  branch_id    uuid NOT NULL REFERENCES public.branches(id),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by   uuid REFERENCES public.internal_profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  sudah_diperiksa     boolean NOT NULL DEFAULT false,
  subjective           text,
  objective             text,
  assessment            text,
  plan                  text,
  keterangan_periksa    text
);

CREATE INDEX IF NOT EXISTS idx_gsn_branch_id  ON public.griya_session_notes(branch_id);
CREATE INDEX IF NOT EXISTS idx_gsn_patient_id ON public.griya_session_notes(patient_id);

DROP TRIGGER IF EXISTS griya_session_notes_updated_at ON public.griya_session_notes;
CREATE TRIGGER griya_session_notes_updated_at BEFORE UPDATE ON public.griya_session_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.griya_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gsn_director_all" ON public.griya_session_notes FOR ALL
USING (get_my_internal_role() = 'director')
WITH CHECK (get_my_internal_role() = 'director');

CREATE POLICY "gsn_branch_staff_all" ON public.griya_session_notes FOR ALL
USING (branch_id = get_my_branch())
WITH CHECK (branch_id = get_my_branch());
