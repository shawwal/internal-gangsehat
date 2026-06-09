-- Migration 024: Add phone_hash for deduplication across internal + public portal
-- SHA-256 of normalized phone number (strip spaces/dashes, standardize to 628xx format)
-- Used to detect returning patients without decrypting encrypted_phone.
-- The hash is computed application-side (Node.js crypto) and stored here as plain text.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS phone_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS patients_phone_hash_unique
  ON public.patients(phone_hash) WHERE phone_hash IS NOT NULL;

-- Notes:
-- Normalization before hashing:
--   1. Strip all spaces, dashes, parentheses, dots, and leading +
--   2. Replace leading 0 with 62  (08xx → 628xx, Indonesian mobile standard)
--   3. SHA-256 the resulting digit string
--
-- This ensures 0812-xxx, +62812-xxx, 62812xxx all produce the same hash.
-- The partial unique index allows multiple NULL values (legacy rows before backfill)
-- while enforcing uniqueness once a hash is set.
--
-- After running this migration, trigger the backfill from the director import page
-- at /director/import → "Jalankan Backfill" to populate hashes for existing patients.
