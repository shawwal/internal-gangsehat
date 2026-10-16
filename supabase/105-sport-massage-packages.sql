-- 105 — Sport Massage packages
-- Sport Massage can now be sold as a package (internal_layanan.kategori =
-- 'PAKET SPORT MASSAGE', jumlah_sesi = N) exactly like fisio packages: one
-- patient_packages row, sessions tracked via patient_visits.package_id, one
-- shared order_id for DP/Pelunasan. Income is recorded under the new
-- transactions.category 'PAKET SPORT MASSAGE'.

ALTER TABLE public.patient_packages DROP CONSTRAINT IF EXISTS patient_packages_category_check;
ALTER TABLE public.patient_packages ADD CONSTRAINT patient_packages_category_check
  CHECK (category IN ('PAKET KLINIK', 'PAKET VISIT', 'PAKET SPORT MASSAGE'));
