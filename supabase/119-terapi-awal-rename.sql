-- One vocabulary everywhere: the Tarif Layanan kategori names ("Issue Singkatan").
-- First step of the data consistency work.
--
--   Service type / category values (visits, Layanan, payments, packages, Griya
--   schedules, online bookings, payroll sources, logs, snapshots):
--     TERAPI AWAL  → TERAPI AWAL KLINIK      TA KLINIK → TERAPI AWAL KLINIK
--     SESI TERAPI  → SESI KLINIK             TA VISIT  → TERAPI AWAL VISIT
--     PAKET TERAPI → PAKET KLINIK
--   A visit's service type and its income category are now the same word.
--
--   Payroll activity codes (+ labels, groups) — also inside compensation versions,
--   locked inputs, issued slips and period snapshots:
--     KLINIK_PT → PAKET_KLINIK        VISIT_PT → PAKET_VISIT       VISIT_JARAK → JARAK_VISIT
--     KLINIK_ST → SESI_KLINIK         VISIT_ST → SESI_VISIT        ADMIN_TA    → TERAPI_AWAL_ADMIN
--     KLINIK_TA → TERAPI_AWAL_KLINIK  VISIT_TA → TERAPI_AWAL_VISIT
--     SM_FB → SPORT_MASSAGE_FULL_BODY             VISIT_SM_FB → SPORT_MASSAGE_VISIT_FULL_BODY
--     SM_SG → SPORT_MASSAGE_SEGMENTAL             VISIT_SM_SG → SPORT_MASSAGE_VISIT_SEGMENTAL
--     VISIT_SM_PAKET_FB → PAKET_SPORT_MASSAGE_VISIT_FULL_BODY
--     VISIT_SM_PAKET_SG → PAKET_SPORT_MASSAGE_VISIT_SEGMENTAL
--     VISIT_SM_JARAK    → JARAK_SPORT_MASSAGE_VISIT
--
--   PFOTM metric keys: ta_sesi_visit → terapi_awal_sesi_visit, rujukan_sm → rujukan_sport_massage
--   Targets: column target_ta → target_terapi_awal; category key 'ta' → 'terapi_awal'
--
-- Integrity (the "connected properly" part):
--   * income_categories (lookup) ← FK internal_layanan.kategori, patient_packages.category,
--     payment_links.category; income transactions are checked by trigger (the column
--     also holds per-branch expense categories, so it can't take a plain FK).
--   * visit_service_types (lookup, each code IS an income category) ← FK
--     patient_visits.service_type, internal_layanan.online_service_type,
--     griya_schedule_slots.service_type, online_bookings.service_type.
--     (Not public.service_types — that is gangsehat.com's public catalog.)
--   * Every FK is ON UPDATE CASCADE and income_categories carries a trigger for the
--     non-FK places: a future rename is ONE update on income_categories.code.
--
-- Guard triggers on locked / immutable rows are switched off for this transaction
-- only (pure renames; no amount, quantity or status changes).
-- Order: deploy the app first, then run this right away in the Supabase SQL editor.

BEGIN;

-- ── 0. Rename helpers: functions only (no helper tables — the SQL editor can
--    check table references before earlier statements run). Dropped at the end.
CREATE OR REPLACE FUNCTION public._mig119_value_map() RETURNS TABLE (old text, new text) LANGUAGE sql IMMUTABLE AS $map$
  VALUES
  ('TERAPI AWAL',  'TERAPI AWAL KLINIK'),
  ('SESI TERAPI',  'SESI KLINIK'),
  ('PAKET TERAPI', 'PAKET KLINIK'),
  ('TA KLINIK',    'TERAPI AWAL KLINIK'),
  ('TA VISIT',     'TERAPI AWAL VISIT')
$map$;

CREATE OR REPLACE FUNCTION public._mig119_code_map() RETURNS TABLE (old text, new text, label text) LANGUAGE sql IMMUTABLE AS $map$
  VALUES
  ('KLINIK_PT',         'PAKET_KLINIK',                        'Paket Klinik'),
  ('KLINIK_ST',         'SESI_KLINIK',                         'Sesi Klinik'),
  ('KLINIK_TA',         'TERAPI_AWAL_KLINIK',                  'Terapi Awal Klinik'),
  ('VISIT_PT',          'PAKET_VISIT',                         'Paket Visit'),
  ('VISIT_ST',          'SESI_VISIT',                          'Sesi Visit'),
  ('VISIT_TA',          'TERAPI_AWAL_VISIT',                   'Terapi Awal Visit'),
  ('VISIT_JARAK',       'JARAK_VISIT',                         'Jarak Visit'),
  ('SM_FB',             'SPORT_MASSAGE_FULL_BODY',             'Sport Massage Full Body'),
  ('SM_SG',             'SPORT_MASSAGE_SEGMENTAL',             'Sport Massage Segmental'),
  ('VISIT_SM_FB',       'SPORT_MASSAGE_VISIT_FULL_BODY',       'Sport Massage Visit Full Body'),
  ('VISIT_SM_SG',       'SPORT_MASSAGE_VISIT_SEGMENTAL',       'Sport Massage Visit Segmental'),
  ('VISIT_SM_PAKET_FB', 'PAKET_SPORT_MASSAGE_VISIT_FULL_BODY', 'Paket Sport Massage Visit Full Body'),
  ('VISIT_SM_PAKET_SG', 'PAKET_SPORT_MASSAGE_VISIT_SEGMENTAL', 'Paket Sport Massage Visit Segmental'),
  ('VISIT_SM_JARAK',    'JARAK_SPORT_MASSAGE_VISIT',           'Jarak Sport Massage Visit'),
  ('ADMIN_TA',          'TERAPI_AWAL_ADMIN',                   'Terapi Awal Diinput (Admin)')
$map$;

-- Old display strings (exact JSON strings in snapshots / slips) → new.
CREATE OR REPLACE FUNCTION public._mig119_label_map() RETURNS TABLE (old text, new text) LANGUAGE sql IMMUTABLE AS $map$
  VALUES
  ('PT (Paket Terapi)',  'Paket Klinik'),
  ('ST (Sesi Terapi)',   'Sesi Klinik'),
  ('TA (Terapi Awal)',   'Terapi Awal Klinik'),
  ('PT Visit (Paket)',   'Paket Visit'),
  ('ST Visit (Sesi)',    'Sesi Visit'),
  ('TA Visit',           'Terapi Awal Visit'),
  ('Jarak Visit FT',     'Jarak Visit'),
  ('FB (Sport Massage)', 'Sport Massage Full Body'),
  ('SG (Sport Massage)', 'Sport Massage Segmental'),
  ('FB Visit SM',        'Sport Massage Visit Full Body'),
  ('SG Visit SM',        'Sport Massage Visit Segmental'),
  ('Paket FB Visit SM',  'Paket Sport Massage Visit Full Body'),
  ('Paket SG Visit SM',  'Paket Sport Massage Visit Segmental'),
  ('Jarak Visit SM',     'Jarak Sport Massage Visit'),
  ('TA Diinput (Admin)', 'Terapi Awal Diinput (Admin)'),
  ('Klinik FT',          'Klinik Fisioterapi'),
  ('Klinik SM',          'Klinik Sport Massage'),
  ('Visit FT',           'Visit Fisioterapi'),
  ('Visit SM',           'Visit Sport Massage'),
  ('Terapi Awal dan Sesi Terapi Visit', 'Terapi Awal Visit dan Sesi Visit'),
  ('Rujukan Sports Massage',            'Rujukan Sport Massage')
$map$;

-- Rewrites one JSON / text blob: codes and PFOTM keys as whole words, values and
-- labels only as exact JSON strings (so free text like a Layanan name is untouched).
CREATE OR REPLACE FUNCTION public._mig119_remap(t text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  FOR r IN SELECT old, new FROM public._mig119_code_map() ORDER BY length(old) DESC LOOP
    t := regexp_replace(t, '\m' || r.old || '\M', r.new, 'g');
  END LOOP;
  t := regexp_replace(t, '\mta_sesi_visit\M', 'terapi_awal_sesi_visit', 'g');
  t := regexp_replace(t, '\mrujukan_sm\M',    'rujukan_sport_massage',  'g');
  t := regexp_replace(t, '\mtarget_ta\M',     'target_terapi_awal',     'g');
  FOR r IN SELECT old, new FROM public._mig119_value_map() LOOP
    t := replace(t, '"' || r.old || '"', '"' || r.new || '"');
  END LOOP;
  FOR r IN SELECT old, new FROM public._mig119_label_map() LOOP
    t := replace(t, '"' || r.old || '"', '"' || r.new || '"');
  END LOOP;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public._mig119_remap_arr(a text[]) RETURNS text[] LANGUAGE sql AS $$
  SELECT CASE WHEN a IS NULL THEN NULL ELSE ARRAY(
    SELECT coalesce(v.new, c.new, x)
    FROM unnest(a) WITH ORDINALITY u(x, i)
    LEFT JOIN public._mig119_value_map() v ON v.old = x
    LEFT JOIN public._mig119_code_map()  c ON c.old = x
    ORDER BY i) END
$$;

-- Guards on locked / immutable rows: off for this transaction only.
ALTER TABLE public.employee_compensation   DISABLE TRIGGER employee_compensation_append_only;
ALTER TABLE public.payroll_activity_counts DISABLE TRIGGER payroll_activity_counts_lock;
ALTER TABLE public.payroll_activity_counts DISABLE TRIGGER payroll_activity_counts_updated_at;
ALTER TABLE public.payroll_slips           DISABLE TRIGGER payroll_slips_immutable;
ALTER TABLE public.pfotm_entries           DISABLE TRIGGER pfotm_entries_guard;
ALTER TABLE public.pfotm_entries           DISABLE TRIGGER pfotm_entries_updated_at;
ALTER TABLE public.pfotm_periods           DISABLE TRIGGER pfotm_periods_guard;
ALTER TABLE public.pfotm_periods           DISABLE TRIGGER pfotm_periods_updated_at;

-- ── 1. Lookup tables ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.income_categories (
  code       text PRIMARY KEY,
  label      text NOT NULL,
  is_package boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.income_categories (code, label, is_package, sort_order) VALUES
  ('TERAPI AWAL KLINIK',  'Terapi Awal Klinik',  false, 10),
  ('SESI KLINIK',         'Sesi Klinik',         false, 20),
  ('PAKET KLINIK',        'Paket Klinik',        true,  30),
  ('TERAPI AWAL VISIT',   'Terapi Awal Visit',   false, 40),
  ('SESI VISIT',          'Sesi Visit',          false, 50),
  ('PAKET VISIT',         'Paket Visit',         true,  60),
  ('SPORT MASSAGE',       'Sport Massage',       false, 70),
  ('PAKET SPORT MASSAGE', 'Paket Sport Massage', true,  80),
  ('TOKO',                'Toko',                false, 90),
  ('LAINNYA',             'Lainnya',             false, 100)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, is_package = EXCLUDED.is_package, sort_order = EXCLUDED.sort_order;

-- A visit service type is an income category (same word) — renames cascade down.
CREATE TABLE IF NOT EXISTS public.visit_service_types (
  code       text PRIMARY KEY REFERENCES public.income_categories(code) ON UPDATE CASCADE,
  label      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.visit_service_types (code, label, sort_order) VALUES
  ('TERAPI AWAL KLINIK', 'Terapi Awal Klinik', 10),
  ('PAKET KLINIK',       'Paket Klinik',       20),
  ('SESI KLINIK',        'Sesi Klinik',        30),
  ('TERAPI AWAL VISIT',  'Terapi Awal Visit',  40),
  ('SESI VISIT',         'Sesi Visit',         50),
  ('PAKET VISIT',        'Paket Visit',        60),
  ('SPORT MASSAGE',      'Sport Massage',      70),
  ('LAINNYA',            'Lainnya',            80)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

ALTER TABLE public.income_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_service_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS income_categories_read ON public.income_categories;
CREATE POLICY income_categories_read ON public.income_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS income_categories_director ON public.income_categories;
CREATE POLICY income_categories_director ON public.income_categories FOR ALL TO authenticated
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
DROP POLICY IF EXISTS visit_service_types_read ON public.visit_service_types;
CREATE POLICY visit_service_types_read ON public.visit_service_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS visit_service_types_director ON public.visit_service_types;
CREATE POLICY visit_service_types_director ON public.visit_service_types FOR ALL TO authenticated
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');

-- ── 2. Service type columns → new values + FK ────────────────────────────────
ALTER TABLE public.patient_visits   DROP CONSTRAINT IF EXISTS patient_visits_service_type_check;
ALTER TABLE public.internal_layanan DROP CONSTRAINT IF EXISTS internal_layanan_online_service_type_check;

UPDATE public.patient_visits p       SET service_type = m.new        FROM public._mig119_value_map() m WHERE p.service_type = m.old;
UPDATE public.internal_layanan l     SET online_service_type = m.new FROM public._mig119_value_map() m WHERE l.online_service_type = m.old;
UPDATE public.griya_schedule_slots s SET service_type = m.new        FROM public._mig119_value_map() m WHERE s.service_type = m.old;
UPDATE public.online_bookings b      SET service_type = m.new        FROM public._mig119_value_map() m WHERE b.service_type = m.old;

ALTER TABLE public.patient_visits DROP CONSTRAINT IF EXISTS patient_visits_service_type_fkey;
ALTER TABLE public.patient_visits ADD CONSTRAINT patient_visits_service_type_fkey
  FOREIGN KEY (service_type) REFERENCES public.visit_service_types(code) ON UPDATE CASCADE;
ALTER TABLE public.internal_layanan DROP CONSTRAINT IF EXISTS internal_layanan_online_service_type_fkey;
ALTER TABLE public.internal_layanan ADD CONSTRAINT internal_layanan_online_service_type_fkey
  FOREIGN KEY (online_service_type) REFERENCES public.visit_service_types(code) ON UPDATE CASCADE;
ALTER TABLE public.griya_schedule_slots DROP CONSTRAINT IF EXISTS griya_schedule_slots_service_type_fkey;
ALTER TABLE public.griya_schedule_slots ADD CONSTRAINT griya_schedule_slots_service_type_fkey
  FOREIGN KEY (service_type) REFERENCES public.visit_service_types(code) ON UPDATE CASCADE;
ALTER TABLE public.online_bookings DROP CONSTRAINT IF EXISTS online_bookings_service_type_fkey;
ALTER TABLE public.online_bookings ADD CONSTRAINT online_bookings_service_type_fkey
  FOREIGN KEY (service_type) REFERENCES public.visit_service_types(code) ON UPDATE CASCADE;

-- ── 3. Category columns → new values + FK ────────────────────────────────────
-- (transactions: the reward/affiliate triggers fire only on status/type/patient_id.)
UPDATE public.transactions t     SET category = m.new FROM public._mig119_value_map() m WHERE t.category = m.old;
UPDATE public.internal_layanan l SET kategori = m.new FROM public._mig119_value_map() m WHERE l.kategori = m.old;
UPDATE public.payment_links p    SET category = m.new FROM public._mig119_value_map() m WHERE p.category = m.old;
UPDATE public.patient_packages p SET category = m.new FROM public._mig119_value_map() m WHERE p.category = m.old;

-- Layanan names that are an old word ("… (TA)", "SESI TERAPI"), and the
-- transaction descriptions that copied them. Layanan are matched by id /
-- kategori / harga (packages by name, but none of these is a package).
UPDATE public.internal_layanan SET nama = rtrim(regexp_replace(nama, '\s*\(TA\)\s*$', '')) WHERE nama ~ '\(TA\)\s*$';
UPDATE public.transactions SET description = rtrim(regexp_replace(description, '\s*\(TA\)\s*$', '')) WHERE description ~ '\(TA\)\s*$';
UPDATE public.internal_layanan l SET nama = m.new FROM public._mig119_value_map() m WHERE l.nama = m.old;
UPDATE public.transactions t SET description = m.new FROM public._mig119_value_map() m WHERE t.description = m.old;

ALTER TABLE public.internal_layanan DROP CONSTRAINT IF EXISTS internal_layanan_kategori_fkey;
ALTER TABLE public.internal_layanan ADD CONSTRAINT internal_layanan_kategori_fkey
  FOREIGN KEY (kategori) REFERENCES public.income_categories(code) ON UPDATE CASCADE;
ALTER TABLE public.patient_packages DROP CONSTRAINT IF EXISTS patient_packages_category_fkey;
ALTER TABLE public.patient_packages ADD CONSTRAINT patient_packages_category_fkey
  FOREIGN KEY (category) REFERENCES public.income_categories(code) ON UPDATE CASCADE;
ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_category_fkey;
ALTER TABLE public.payment_links ADD CONSTRAINT payment_links_category_fkey
  FOREIGN KEY (category) REFERENCES public.income_categories(code) ON UPDATE CASCADE;

-- Income transactions must use a known category.
CREATE OR REPLACE FUNCTION public.transactions_check_income_category()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'income' AND NOT EXISTS (SELECT 1 FROM public.income_categories WHERE code = NEW.category) THEN
    RAISE EXCEPTION 'Kategori pemasukan tidak dikenal: %', NEW.category;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transactions_income_category ON public.transactions;
CREATE TRIGGER transactions_income_category BEFORE INSERT OR UPDATE OF category, type ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_check_income_category();

-- A renamed income category follows into the places a FK can't reach.
CREATE OR REPLACE FUNCTION public.income_categories_cascade_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.transactions SET category = NEW.code WHERE type = 'income' AND category = OLD.code;
  UPDATE public.payroll_activity_types
  SET source_service_types = array_replace(source_service_types, OLD.code, NEW.code)
  WHERE OLD.code = ANY (source_service_types);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS income_categories_cascade_code ON public.income_categories;
CREATE TRIGGER income_categories_cascade_code AFTER UPDATE OF code ON public.income_categories
  FOR EACH ROW WHEN (OLD.code IS DISTINCT FROM NEW.code) EXECUTE FUNCTION public.income_categories_cascade_code();

-- ── 4. Payroll: codes, labels, groups, sources (+ every stored copy) ─────────
-- payroll_activity_counts follows the code via its ON UPDATE CASCADE FK.
UPDATE public.payroll_activity_types t SET code = c.new FROM public._mig119_code_map() c WHERE t.code = c.old;
UPDATE public.payroll_activity_types t SET label = c.label FROM public._mig119_code_map() c WHERE t.code = c.new;
UPDATE public.payroll_activity_types t SET group_label = l.new FROM public._mig119_label_map() l WHERE t.group_label = l.old;
UPDATE public.payroll_activity_types SET source_service_types = public._mig119_remap_arr(source_service_types);

UPDATE public.employee_compensation
SET incentive_activity_codes = public._mig119_remap_arr(incentive_activity_codes),
    activity_rates = public._mig119_remap(activity_rates::text)::jsonb,
    bonus_tiers    = public._mig119_remap(bonus_tiers::text)::jsonb;
UPDATE public.employee_payroll_profiles SET branch_total_codes = public._mig119_remap_arr(branch_total_codes)
WHERE branch_total_codes IS NOT NULL;
UPDATE public.internal_layanan SET payroll_units = public._mig119_remap(payroll_units::text)::jsonb
WHERE payroll_units IS NOT NULL;
UPDATE public.payroll_slips
SET compensation = public._mig119_remap(compensation::text)::jsonb,
    activity     = public._mig119_remap(activity::text)::jsonb,
    lines        = public._mig119_remap(lines::text)::jsonb;
UPDATE public.payroll_periods SET settings_snapshot = public._mig119_remap(settings_snapshot::text)::jsonb
WHERE settings_snapshot IS NOT NULL;

-- ── 5. PFOTM metric keys ─────────────────────────────────────────────────────
ALTER TABLE public.internal_layanan DROP CONSTRAINT IF EXISTS internal_layanan_pfotm_metric_check;
UPDATE public.pfotm_point_rules SET metric_key = 'terapi_awal_sesi_visit', metric_label = 'Terapi Awal Visit dan Sesi Visit',
  description = 'Transaksi TERAPI AWAL VISIT + SESI VISIT'
WHERE metric_key = 'ta_sesi_visit';
UPDATE public.pfotm_point_rules SET metric_key = 'rujukan_sport_massage', metric_label = 'Rujukan Sport Massage'
WHERE metric_key = 'rujukan_sm';
UPDATE public.internal_layanan SET pfotm_metric = 'terapi_awal_sesi_visit' WHERE pfotm_metric = 'ta_sesi_visit';
ALTER TABLE public.internal_layanan ADD CONSTRAINT internal_layanan_pfotm_metric_check CHECK (
  pfotm_metric IS NULL OR pfotm_metric IN ('paket_1', 'paket_2', 'paket_3', 'terapi_awal_sesi_visit', 'paket_visit'));
UPDATE public.pfotm_entries
SET auto_metrics     = public._mig119_remap(auto_metrics::text)::jsonb,
    override_metrics = public._mig119_remap(override_metrics::text)::jsonb,
    metrics          = public._mig119_remap(metrics::text)::jsonb,
    points_breakdown = public._mig119_remap(points_breakdown::text)::jsonb,
    kpis             = public._mig119_remap(kpis::text)::jsonb;
UPDATE public.pfotm_periods SET rules_snapshot = public._mig119_remap(rules_snapshot::text)::jsonb
WHERE rules_snapshot IS NOT NULL;

-- ── 6. Targets ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_targets' AND column_name = 'target_ta') THEN
    ALTER TABLE public.staff_targets RENAME COLUMN target_ta TO target_terapi_awal;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branch_targets' AND column_name = 'target_ta') THEN
    ALTER TABLE public.branch_targets RENAME COLUMN target_ta TO target_terapi_awal;
  END IF;
END $$;
ALTER TABLE public.branch_target_category_settings DROP CONSTRAINT IF EXISTS branch_target_category_settings_category_check;
UPDATE public.branch_target_category_settings SET category = 'terapi_awal' WHERE category = 'ta';
ALTER TABLE public.branch_target_category_settings ADD CONSTRAINT branch_target_category_settings_category_check
  CHECK (category IN ('terapi_awal', 'paket_klinik', 'kunjungan', 'paket_visit', 'sesi'));

-- ── 7. History & messages, same words ────────────────────────────────────────
UPDATE public.activity_logs
SET old_values = public._mig119_remap(old_values::text)::jsonb,
    new_values = public._mig119_remap(new_values::text)::jsonb
WHERE old_values IS NOT NULL OR new_values IS NOT NULL;
-- Labels start with the value: "TA KLINIK — Rp250000", "TERAPI AWAL 1".
UPDATE public.activity_logs a
SET resource_label = m.new || substr(a.resource_label, length(m.old) + 1)
FROM public._mig119_value_map() m
WHERE a.resource_label = m.old OR a.resource_label LIKE m.old || ' %';
UPDATE public.activity_logs SET resource_id = public._mig119_remap(resource_id), resource_label = public._mig119_remap(resource_label)
WHERE resource_type = 'payroll_activity';
-- PFOTM edits: "PUTRI · rujukan_sm".
UPDATE public.activity_logs SET resource_label = public._mig119_remap(resource_label)
WHERE resource_type = 'pfotm_entry' AND resource_label ~ '\m(ta_sesi_visit|rujukan_sm)\M';
-- Payment-link labels: "QRIS TA KLINIK — Rp250000 (GS…)".
UPDATE public.activity_logs
SET resource_label = regexp_replace(regexp_replace(resource_label,
      '\mTA KLINIK\M', 'TERAPI AWAL KLINIK', 'g'),
      '\mTA VISIT\M',  'TERAPI AWAL VISIT',  'g')
WHERE resource_label ~ '\mTA (KLINIK|VISIT)\M';
-- Field names (PFOTM metric keys, target columns) in the changed-fields list.
UPDATE public.activity_logs
SET changed_fields = ARRAY(SELECT public._mig119_remap(x) FROM unnest(changed_fields) WITH ORDINALITY u(x, i) ORDER BY i)
WHERE changed_fields::text ~ '\m(ta_sesi_visit|rujukan_sm|target_ta)\M';

UPDATE public.user_notifications
SET message = regexp_replace(regexp_replace(message,
      '\mTA KLINIK\M', 'TERAPI AWAL KLINIK', 'g'),
      '\mTA VISIT\M',  'TERAPI AWAL VISIT',  'g')
WHERE message ~ '\mTA (KLINIK|VISIT)\M';

-- DOKU payloads carry our own item names ("TA KLINIK - …").
UPDATE public.payment_links
SET raw_status        = regexp_replace(regexp_replace(raw_status::text, '\mTA KLINIK\M', 'TERAPI AWAL KLINIK', 'g'), '\mTA VISIT\M', 'TERAPI AWAL VISIT', 'g')::jsonb,
    last_notification = regexp_replace(regexp_replace(last_notification::text, '\mTA KLINIK\M', 'TERAPI AWAL KLINIK', 'g'), '\mTA VISIT\M', 'TERAPI AWAL VISIT', 'g')::jsonb
WHERE raw_status::text ~ '\mTA (KLINIK|VISIT)\M' OR last_notification::text ~ '\mTA (KLINIK|VISIT)\M';

-- ── 8. Guards back on ────────────────────────────────────────────────────────
ALTER TABLE public.employee_compensation   ENABLE TRIGGER employee_compensation_append_only;
ALTER TABLE public.payroll_activity_counts ENABLE TRIGGER payroll_activity_counts_lock;
ALTER TABLE public.payroll_activity_counts ENABLE TRIGGER payroll_activity_counts_updated_at;
ALTER TABLE public.payroll_slips           ENABLE TRIGGER payroll_slips_immutable;
ALTER TABLE public.pfotm_entries           ENABLE TRIGGER pfotm_entries_guard;
ALTER TABLE public.pfotm_entries           ENABLE TRIGGER pfotm_entries_updated_at;
ALTER TABLE public.pfotm_periods           ENABLE TRIGGER pfotm_periods_guard;
ALTER TABLE public.pfotm_periods           ENABLE TRIGGER pfotm_periods_updated_at;

DROP FUNCTION IF EXISTS public._mig119_remap_arr(text[]);
DROP FUNCTION IF EXISTS public._mig119_remap(text);
DROP FUNCTION IF EXISTS public._mig119_value_map(), public._mig119_code_map(), public._mig119_label_map();

NOTIFY pgrst, 'reload schema';

COMMIT;
