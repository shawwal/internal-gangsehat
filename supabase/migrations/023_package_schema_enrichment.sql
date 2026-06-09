-- Migration 023: Enrich patient_packages table with operational tracking fields
-- Derived from EX. DATA PELAYANAN 2025.xlsx (Paket sheet)

ALTER TABLE public.patient_packages
  ADD COLUMN IF NOT EXISTS jenis_paket        text
    CHECK (jenis_paket IN ('P1', 'P2')),
  ADD COLUMN IF NOT EXISTS mulai_paket        text
    CHECK (mulai_paket IN ('NEW', 'EXT.')),
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'ON'
    CHECK (operational_status IN ('ON', 'OFF', 'PENDING')),
  ADD COLUMN IF NOT EXISTS completion_status  text
    CHECK (completion_status IN ('LANJUT', 'SEMBUH', 'TIDAK LANJUT', 'STOP')),
  -- Individual session dates T1-T10 (flat columns matching Excel structure)
  ADD COLUMN IF NOT EXISTS t1  date,
  ADD COLUMN IF NOT EXISTS t2  date,
  ADD COLUMN IF NOT EXISTS t3  date,
  ADD COLUMN IF NOT EXISTS t4  date,
  ADD COLUMN IF NOT EXISTS t5  date,
  ADD COLUMN IF NOT EXISTS t6  date,
  ADD COLUMN IF NOT EXISTS t7  date,
  ADD COLUMN IF NOT EXISTS t8  date,
  ADD COLUMN IF NOT EXISTS t9  date,
  ADD COLUMN IF NOT EXISTS t10 date;

-- Notes:
-- `jenis_paket`        = P1 (5 sessions) or P2 (10 sessions)
--                        P1 uses t1–t5 only; t6–t10 remain NULL for P1 packages
-- `mulai_paket`        = NEW (first package for this treatment episode) or EXT. (extension/renewal)
-- `operational_status` = ON / OFF / PENDING — current active state of the package
-- `completion_status`  = outcome when package is finished:
--                        LANJUT     = patient continuing (bought new package)
--                        SEMBUH     = patient recovered / discharged
--                        TIDAK LANJUT = patient did not continue
--                        STOP       = patient stopped mid-package
-- `t1`–`t10`           = individual session dates, matching Excel columns T1–T10
--                        Flat date columns avoid junction table complexity while
--                        exactly matching the clinic's existing tracking model
