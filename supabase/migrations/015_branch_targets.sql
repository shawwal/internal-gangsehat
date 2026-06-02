-- ============================================================
-- Migration 015: branch_targets table + RLS
-- Monthly targets set per branch, approved by director.
-- Managers submit for their own branch; director approves.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_targets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  bulan               int NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun               int NOT NULL,
  target_ta           int NOT NULL DEFAULT 0,   -- Target Terapi Awal
  target_paket_klinik int NOT NULL DEFAULT 0,   -- Target Paket Klinik
  target_kunjungan    int NOT NULL DEFAULT 0,   -- Target Kunjungan
  target_visit        int NOT NULL DEFAULT 0,   -- Target Visit / Homevisit
  notes               text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  set_by              uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  reviewed_by         uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  rejection_note      text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (branch_id, bulan, tahun)
);

ALTER TABLE public.branch_targets ENABLE ROW LEVEL SECURITY;

-- Director: full access across all branches
CREATE POLICY "bt: director all"
  ON public.branch_targets FOR ALL
  USING  (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- Manager: full access scoped to their own branch only.
-- get_my_branch() IS NOT NULL guard prevents NULL-branch edge cases.
CREATE POLICY "bt: manager branch"
  ON public.branch_targets FOR ALL
  USING  (
    get_my_internal_role() = 'manager'
    AND get_my_branch() IS NOT NULL
    AND branch_id = get_my_branch()
  )
  WITH CHECK (
    get_my_internal_role() = 'manager'
    AND get_my_branch() IS NOT NULL
    AND branch_id = get_my_branch()
  );
