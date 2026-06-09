-- Migration 022: Enrich patients table with additional demographics
-- Derived from EX. DATA PELAYANAN 2025.xlsx (Pasien sheet)
--
-- IMPORTANT: `patients` is shared with gangsehat.com.
-- All new columns are nullable → additive-safe; gangsehat.com queries are unaffected.
-- Non-PII fields are stored as plain text (not encrypted).
-- encrypted_address is preserved for backward compatibility.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS no_rm          text,
  ADD COLUMN IF NOT EXISTS pekerjaan      text,
  ADD COLUMN IF NOT EXISTS agama          text,
  ADD COLUMN IF NOT EXISTS hobi           text,
  ADD COLUMN IF NOT EXISTS kelurahan      text,
  ADD COLUMN IF NOT EXISTS kecamatan      text,
  ADD COLUMN IF NOT EXISTS kabupaten_kota text,
  ADD COLUMN IF NOT EXISTS provinsi       text;

-- Partial unique index: no_rm must be unique when provided (NULLs excluded)
CREATE UNIQUE INDEX IF NOT EXISTS patients_no_rm_unique
  ON public.patients(no_rm) WHERE no_rm IS NOT NULL;

-- Notes:
-- `no_rm`          = medical record number, format: LETTER+year+sequence
--                    e.g. "Z0922105765" — used as patient identifier in clinic operations
-- `pekerjaan`      = occupation (non-PII operational metadata)
-- `agama`          = religion (stored as plain text; common values:
--                    ISLAM, KRISTEN PROTESTAN, KRISTEN KATOLIK, HINDU, BUDHA, KONGHUCU, LAINNYA)
-- `hobi`           = hobby / daily activity (non-PII, free text)
-- `kelurahan`      = village/kelurahan — granular address breakdown
-- `kecamatan`      = sub-district
-- `kabupaten_kota` = city/regency
-- `provinsi`       = province
-- The granular address fields supplement `encrypted_address` (which holds the full address string).
