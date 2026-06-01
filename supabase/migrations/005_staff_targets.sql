-- ============================================================
-- Migration 005: staff_targets table + RLS
-- Monthly targets set by staff, approved by director.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_targets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            uuid NOT NULL REFERENCES public.internal_profiles(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES public.branches(id),
  bulan               int NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun               int NOT NULL,
  target_ta           int NOT NULL DEFAULT 0,   -- Target Terapi Awal
  target_paket_klinik int NOT NULL DEFAULT 0,   -- Target Paket Klinik
  target_kunjungan    int NOT NULL DEFAULT 0,   -- Target Kunjungan
  target_visit        int NOT NULL DEFAULT 0,   -- Target Visit / Homevisit
  notes               text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by         uuid REFERENCES public.internal_profiles(id),
  reviewed_at         timestamptz,
  rejection_note      text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (staff_id, bulan, tahun)
);

ALTER TABLE public.staff_targets ENABLE ROW LEVEL SECURITY;

-- Staff: manage their own targets (insert, update pending ones, read own)
CREATE POLICY "st: own all"
  ON public.staff_targets FOR ALL
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

-- Director: full access across all branches
CREATE POLICY "st: director all"
  ON public.staff_targets FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- HR: read their own branch's targets
CREATE POLICY "st: hr reads branch"
  ON public.staff_targets FOR SELECT
  USING (
    get_my_internal_role() = 'hr'
    AND branch_id = get_my_branch()
  );
