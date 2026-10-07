-- PFOTM: Jumlah Kunjungan now counts only visits whose medical record is
-- "Lengkap"; Paket 1/2/3, TA/Sesi Visit and Paket Visit come from income
-- transactions marked LUNAS or DP (app/actions/pfotm.ts). Descriptions only —
-- weights are untouched.
UPDATE public.pfotm_point_rules SET description = 'Sesi klinik (TA, sesi, paket) dengan rekam medis lengkap' WHERE metric_key = 'kunjungan';
UPDATE public.pfotm_point_rules SET description = 'Transaksi PAKET KLINIK P1 (LUNAS/DP)'                    WHERE metric_key = 'paket_1';
UPDATE public.pfotm_point_rules SET description = 'Transaksi PAKET KLINIK P2 (LUNAS/DP)'                    WHERE metric_key = 'paket_2';
UPDATE public.pfotm_point_rules SET description = 'Transaksi PAKET KLINIK P3 (LUNAS/DP)'                    WHERE metric_key = 'paket_3';
UPDATE public.pfotm_point_rules SET description = 'Transaksi TA VISIT + SESI VISIT (LUNAS/DP)'              WHERE metric_key = 'ta_sesi_visit';
UPDATE public.pfotm_point_rules SET description = 'Transaksi PAKET VISIT (LUNAS/DP)'                        WHERE metric_key = 'paket_visit';
