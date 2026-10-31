-- Sport Massage payroll auto-fill (QA 29 Okt 2026).
--
-- Klinik — SPORT_MASSAGE_FULL_BODY / _SEGMENTAL count every attended SPORT MASSAGE
-- visit (session mode) whose Layanan is a Full Body / Segmental clinic Layanan
-- (Sesi or Paket, not Home Visit). Package visits resolve their Layanan via
-- patient_packages.layanan_id (app/actions/payroll.ts loadActivityInput).
-- Combo packages match neither and stay manual until their split is decided.
--
-- Visit — the Home Visit codes + JARAK_SPORT_MASSAGE_VISIT count LUNAS / PELUNASAN
-- payments by Layanan + Fisio (migration 115 mechanism): tag Pontianak's Home
-- Visit Sport Massage Layanan with payroll_units. Jarak units = sessions the
-- "+ Jarak" Layanan covers (Sesi 1, Paket Full Body 2, Paket Segmental 3).

UPDATE public.payroll_activity_types t
SET count_mode = 'session',
    source_service_types = ARRAY['SPORT MASSAGE'],
    source_layanan_ids = COALESCE((
      SELECT array_agg(l.id ORDER BY l.id)
      FROM public.internal_layanan l
      WHERE l.kategori IN ('SPORT MASSAGE', 'PAKET SPORT MASSAGE')
        AND l.nama !~* 'visit'
        AND l.nama ~* CASE t.code WHEN 'SPORT_MASSAGE_FULL_BODY' THEN 'full\s*body' ELSE 'segmental' END
        AND l.nama !~* 'combo'
    ), '{}')
WHERE t.code IN ('SPORT_MASSAGE_FULL_BODY', 'SPORT_MASSAGE_SEGMENTAL');

WITH l AS (
  SELECT id, lower(regexp_replace(trim(nama), '\s+', ' ', 'g')) AS n
  FROM public.internal_layanan
  WHERE branch_id = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
)
UPDATE public.internal_layanan il
SET payroll_units = il.payroll_units || v.units::jsonb
FROM l
JOIN (VALUES
  ('sesi full body sports massage home visit',              '{"SPORT_MASSAGE_VISIT_FULL_BODY":1}'),
  ('sesi full body sports massage home visit + jarak',      '{"SPORT_MASSAGE_VISIT_FULL_BODY":1,"JARAK_SPORT_MASSAGE_VISIT":1}'),
  ('sesi segmental sports massage home visit',              '{"SPORT_MASSAGE_VISIT_SEGMENTAL":1}'),
  ('sesi segmental sports massage home visit + jarak',      '{"SPORT_MASSAGE_VISIT_SEGMENTAL":1,"JARAK_SPORT_MASSAGE_VISIT":1}'),
  ('paket full body sports massage home visit',             '{"PAKET_SPORT_MASSAGE_VISIT_FULL_BODY":1}'),
  ('paket full body sports massage home visit + jarak',     '{"PAKET_SPORT_MASSAGE_VISIT_FULL_BODY":1,"JARAK_SPORT_MASSAGE_VISIT":2}'),
  ('paket segmental sports massage home visit',             '{"PAKET_SPORT_MASSAGE_VISIT_SEGMENTAL":1}'),
  ('paket segmental sports massage home visit + jarak',     '{"PAKET_SPORT_MASSAGE_VISIT_SEGMENTAL":1,"JARAK_SPORT_MASSAGE_VISIT":3}')
) AS v(n, units) ON v.n = l.n
WHERE il.id = l.id;
