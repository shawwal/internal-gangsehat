-- Migration: Griya Anak rekam medis types (DEFAULT / FISIOTERAPI / PSIKOLOG)
-- Run this in the Supabase SQL editor, after 084.
--
-- griya_terapi_awal gains rm_type, picking which intake form a record uses:
--   DEFAULT     — the existing "Rekam Medis Sensori Integrasi" form (all existing rows)
--   FISIOTERAPI — paper form "04 FISIOTERAPI-REKAM MEDIS"
--   PSIKOLOG    — paper form "RM PSIKOLOG KLINIS"
-- The type is suggested from the visit's discipline (slot / griya_therapists)
-- and saved on the row. Additive only; RLS unchanged.

ALTER TABLE public.griya_terapi_awal
  ADD COLUMN IF NOT EXISTS rm_type text NOT NULL DEFAULT 'DEFAULT'
    CHECK (rm_type IN ('DEFAULT', 'FISIOTERAPI', 'PSIKOLOG')),

  -- Fisioterapi: Riwayat Kehamilan
  ADD COLUMN IF NOT EXISTS problem_kehamilan     text,
  ADD COLUMN IF NOT EXISTS obat_kehamilan        text,
  ADD COLUMN IF NOT EXISTS penyakit_ibu          text,
  ADD COLUMN IF NOT EXISTS vitamin_kehamilan     text,
  ADD COLUMN IF NOT EXISTS aktivitas_ibu_hamil   text,
  -- Fisioterapi: Riwayat Kelahiran
  ADD COLUMN IF NOT EXISTS kelahiran_lainnya     text,
  -- Fisioterapi: Indeks IMT (standar; current values reuse berat/tinggi/lingkar)
  ADD COLUMN IF NOT EXISTS bb_standar            text,
  ADD COLUMN IF NOT EXISTS tb_standar            text,
  ADD COLUMN IF NOT EXISTS lk_standar            text,
  -- Fisioterapi: Regulasi Reflek Anak
  ADD COLUMN IF NOT EXISTS reflek_rooting        text,
  ADD COLUMN IF NOT EXISTS reflek_moro           text,
  ADD COLUMN IF NOT EXISTS reflek_sucking        text,
  ADD COLUMN IF NOT EXISTS reflek_atnr           text,
  ADD COLUMN IF NOT EXISTS reflek_grasping       text,
  ADD COLUMN IF NOT EXISTS reflek_babinski       text,
  ADD COLUMN IF NOT EXISTS reflek_step           text,
  -- Fisioterapi: penunjang & program
  ADD COLUMN IF NOT EXISTS pemeriksaan_penunjang text,
  ADD COLUMN IF NOT EXISTS program_fisioterapi   text,
  ADD COLUMN IF NOT EXISTS program_tambahan      text,

  -- Psikolog
  ADD COLUMN IF NOT EXISTS hubungan              text,
  ADD COLUMN IF NOT EXISTS anak_ke               text,
  ADD COLUMN IF NOT EXISTS jumlah_saudara        text,
  ADD COLUMN IF NOT EXISTS durasi_keluhan        text
    CHECK (durasi_keluhan IN ('<1_MINGGU', '1MG_1BLN', '1_6_BLN', '>6_BLN')),
  ADD COLUMN IF NOT EXISTS harapan_sesi          text,
  ADD COLUMN IF NOT EXISTS tl_konseling_lanjutan text,
  ADD COLUMN IF NOT EXISTS tl_psikoterapi        text;
