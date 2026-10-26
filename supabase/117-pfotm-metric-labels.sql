-- PFOTM column names without abbreviations ("Issue Singkatan"), matching the
-- Tarif Layanan names each column counts. Labels only — keys, weights and the
-- Layanan tags (migration 115) are unchanged. Keep in sync with lib/pfotm/labels.ts.
-- Run this in the Supabase SQL editor.

UPDATE public.pfotm_point_rules r
SET metric_label = v.label, description = v.description
FROM (VALUES
  ('paket_1',       'Paket 5 sessions',                  'Paket 1 Fisioterapi + Paket Silver Fisioterapi'),
  ('paket_2',       'Paket 10 sessions',                 'Paket 2 Fisioterapi + Paket Gold Fisioterapi'),
  ('paket_3',       'Paket 20 sessions',                 'Paket Platinum Fisioterapi'),
  ('ta_sesi_visit', 'Terapi Awal dan Sesi Terapi Visit', 'Terapi Awal / Sesi Terapi Home Visit Fisioterapi (dengan atau tanpa Jarak)'),
  ('paket_visit',   'Paket Visit',                       'Paket Home Visit Fisioterapi (dengan atau tanpa Jarak)'),
  ('rujukan_sm',    'Rujukan Sports Massage',            'Pasien baru yang dirujuk oleh fisioterapis')
) AS v(metric_key, label, description)
WHERE r.metric_key = v.metric_key;

-- Locked periods show their frozen rules_snapshot; rename the labels there too
-- (weights in the snapshot are left exactly as they were locked).
UPDATE public.pfotm_periods p
SET rules_snapshot = (
  SELECT jsonb_agg(
    CASE s->>'metric_key'
      WHEN 'paket_1'       THEN jsonb_set(s, '{metric_label}', '"Paket 5 sessions"')
      WHEN 'paket_2'       THEN jsonb_set(s, '{metric_label}', '"Paket 10 sessions"')
      WHEN 'paket_3'       THEN jsonb_set(s, '{metric_label}', '"Paket 20 sessions"')
      WHEN 'ta_sesi_visit' THEN jsonb_set(s, '{metric_label}', '"Terapi Awal dan Sesi Terapi Visit"')
      WHEN 'paket_visit'   THEN jsonb_set(s, '{metric_label}', '"Paket Visit"')
      WHEN 'rujukan_sm'    THEN jsonb_set(s, '{metric_label}', '"Rujukan Sports Massage"')
      ELSE s
    END ORDER BY ord)
  FROM jsonb_array_elements(p.rules_snapshot) WITH ORDINALITY AS t(s, ord)
)
WHERE p.rules_snapshot IS NOT NULL AND jsonb_typeof(p.rules_snapshot) = 'array';
