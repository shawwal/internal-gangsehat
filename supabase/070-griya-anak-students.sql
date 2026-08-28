-- Migration: Griya Anak student roster (Milestone 1 follow-up)
-- Run this in the Supabase SQL editor, after 066.
--
-- `patients` is a shared table with no branch_id, so "which patients are
-- Griya Anak children" needs its own membership list. griya_students is that
-- roster: the /griya-anak/jadwal student search and the /griya-anak/siswa
-- page both scope to it, instead of the whole patients table.
--
-- Rows are added by:
--   - data_migrations/import-griya-anak-students.ts  (source = 'excel-import')
--   - assigning / substituting a child on /griya-anak/jadwal  (source = 'jadwal')
--   - "Tambah Siswa" on /griya-anak/siswa                     (source = 'manual')
-- and backfilled below from any child already referenced by a Griya slot,
-- visit, or store sale.

CREATE TABLE IF NOT EXISTS public.griya_students (
  patient_id  uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'inactive')),
  source      text,
  notes       text,
  created_by  uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_griya_students_branch ON public.griya_students (branch_id, status);

DROP TRIGGER IF EXISTS griya_students_updated_at ON public.griya_students;
CREATE TRIGGER griya_students_updated_at BEFORE UPDATE ON public.griya_students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.griya_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "griya_students_director_all" ON public.griya_students FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "griya_students_branch_write" ON public.griya_students FOR ALL
  USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());
CREATE POLICY "griya_students_branch_read" ON public.griya_students FOR SELECT
  USING (branch_id = get_my_branch());

-- ── backfill from existing Griya references ───────────────────────────────
DO $$
DECLARE v_branch uuid;
BEGIN
  SELECT id INTO v_branch FROM public.branches WHERE name ILIKE '%Griya Anak%' LIMIT 1;
  IF v_branch IS NULL THEN RETURN; END IF;

  INSERT INTO public.griya_students (patient_id, branch_id, source)
  SELECT DISTINCT s.patient_id, v_branch, 'backfill'
  FROM public.griya_schedule_slots s WHERE s.branch_id = v_branch
  ON CONFLICT (patient_id) DO NOTHING;

  INSERT INTO public.griya_students (patient_id, branch_id, source)
  SELECT DISTINCT v.patient_id, v_branch, 'backfill'
  FROM public.patient_visits v WHERE v.branch_id = v_branch AND v.griya_slot_id IS NOT NULL
  ON CONFLICT (patient_id) DO NOTHING;
END $$;
