-- Every patient package points at the Tarif Layanan product it was sold as.
--
--   patient_packages.layanan_id → internal_layanan(id) (ON DELETE SET NULL)
--
-- Backfill: per branch, a package links to the one PAKET… Layanan whose name is
-- the same once spelling noise is ignored — case, spaces, an "AGS " prefix and a
-- " Fisioterapi" / " Sports Massage" suffix ("PAKET 1", "Paket 1" → "Paket 1
-- Fisioterapi"; "PAKET SILVER" → "Paket Silver Fisioterapi"). Linked packages take
-- the Layanan's exact name and kategori. Session counts are NOT touched.
-- No match / more than one match → left unlinked with its name as is (listed in
-- the PR: PAKET PENYESUAIAN, Singkawang PAKET VISIT / PAKET MASSAGE, …).
--
-- Kept in sync afterwards by triggers:
--   * a package saved without layanan_id links itself when its name is exactly a
--     PAKET Layanan of its branch (covers every write path: dialogs, import,
--     online booking);
--   * renaming a Layanan in Tarif Layanan renames its linked packages.
--
-- Plain statements only (no temp tables) — safe however the SQL editor splits it.

BEGIN;

ALTER TABLE public.patient_packages
  ADD COLUMN IF NOT EXISTS layanan_id uuid REFERENCES public.internal_layanan(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patient_packages_layanan ON public.patient_packages (layanan_id) WHERE layanan_id IS NOT NULL;

-- Name without spelling noise, for matching only.
CREATE OR REPLACE FUNCTION public.package_name_key(n text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(upper(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g')), '^AGS ', ''),
           ' (FISIOTERAPI|SPORTS? MASSAGE)$', '')
$$;

-- ── Backfill ─────────────────────────────────────────────────────────────────
WITH cand AS (
  SELECT p.id AS package_id, l.id AS layanan_id,
         count(*) OVER (PARTITION BY p.id) AS n
  FROM public.patient_packages p
  JOIN public.internal_layanan l
    ON l.branch_id = p.branch_id
   AND l.kategori LIKE 'PAKET%'
   AND public.package_name_key(l.nama) = public.package_name_key(p.package_name)
  WHERE p.layanan_id IS NULL
)
UPDATE public.patient_packages p
SET layanan_id = c.layanan_id
FROM cand c
WHERE c.package_id = p.id AND c.n = 1;

UPDATE public.patient_packages p
SET package_name = l.nama, category = l.kategori
FROM public.internal_layanan l
WHERE l.id = p.layanan_id
  AND (p.package_name IS DISTINCT FROM l.nama OR p.category IS DISTINCT FROM l.kategori);

-- Unlinked packages with no kategori: from the name.
UPDATE public.patient_packages
SET category = CASE
  WHEN upper(package_name) ~ 'VISIT'               THEN 'PAKET VISIT'
  WHEN upper(package_name) ~ '(MASSAGE|\mSM\M)'    THEN 'PAKET SPORT MASSAGE'
  ELSE 'PAKET KLINIK' END
WHERE category IS NULL;

-- ── Keep it linked ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.patient_packages_link_layanan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_kategori text; v_n int;
BEGIN
  IF NEW.layanan_id IS NULL AND NEW.package_name IS NOT NULL THEN
    SELECT min(id::text)::uuid, min(kategori), count(*) INTO v_id, v_kategori, v_n
    FROM internal_layanan
    WHERE branch_id = NEW.branch_id AND kategori LIKE 'PAKET%'
      AND package_name_key(nama) = package_name_key(NEW.package_name);
    IF v_n = 1 THEN
      NEW.layanan_id := v_id;
      NEW.category := coalesce(NEW.category, v_kategori);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS patient_packages_link_layanan ON public.patient_packages;
CREATE TRIGGER patient_packages_link_layanan
  BEFORE INSERT OR UPDATE OF package_name, branch_id, layanan_id ON public.patient_packages
  FOR EACH ROW EXECUTE FUNCTION public.patient_packages_link_layanan();

CREATE OR REPLACE FUNCTION public.internal_layanan_rename_packages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE patient_packages SET package_name = NEW.nama
  WHERE layanan_id = NEW.id AND package_name = OLD.nama;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS internal_layanan_rename_packages ON public.internal_layanan;
CREATE TRIGGER internal_layanan_rename_packages
  AFTER UPDATE OF nama ON public.internal_layanan
  FOR EACH ROW WHEN (OLD.nama IS DISTINCT FROM NEW.nama)
  EXECUTE FUNCTION public.internal_layanan_rename_packages();

NOTIFY pgrst, 'reload schema';

COMMIT;
