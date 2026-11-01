-- Closing Admin: daily submit → Finance approval.
-- Admin (or manager / director) submits a branch's day from /closing; Finance of
-- that branch (or the director) approves it — "the day's data is correct, no
-- further correction needed" — or rejects it with a note so admin can fix and
-- resubmit. One row per branch per day.

CREATE TABLE IF NOT EXISTS public.closing_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  closing_date  date NOT NULL,
  status        text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  -- Day totals as the submitter saw them (income / expense / cash / visits)
  snapshot      jsonb,
  submitted_by  uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by   uuid REFERENCES public.internal_profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, closing_date)
);

CREATE INDEX IF NOT EXISTS closing_submissions_branch_date_idx
  ON public.closing_submissions (branch_id, closing_date DESC);

ALTER TABLE public.closing_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "closing_submissions_director" ON public.closing_submissions;
CREATE POLICY "closing_submissions_director" ON public.closing_submissions FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

DROP POLICY IF EXISTS "closing_submissions_branch" ON public.closing_submissions;
CREATE POLICY "closing_submissions_branch" ON public.closing_submissions FOR ALL
  USING (get_my_internal_role() IN ('admin', 'manager', 'finance') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('admin', 'manager', 'finance') AND branch_id = get_my_branch());

-- Who may move the status: only finance / director decide (approved / rejected),
-- and an approved day is final for everyone else. Enforced here so the REST API
-- can't skip the server action's checks.
CREATE OR REPLACE FUNCTION public.closing_submissions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role text := get_my_internal_role();
BEGIN
  -- Service role / SQL editor (no auth.uid()) is unrestricted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role IN ('finance', 'director') THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Closing tanggal ini sudah disetujui Finance dan tidak bisa diubah.';
  END IF;
  IF NEW.status <> 'submitted' THEN
    RAISE EXCEPTION 'Hanya Finance yang dapat menyetujui atau menolak closing.';
  END IF;

  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.review_note := NULL;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS closing_submissions_guard ON public.closing_submissions;
CREATE TRIGGER closing_submissions_guard
  BEFORE INSERT OR UPDATE ON public.closing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.closing_submissions_guard();

-- Approved closings are history — only the director may delete one.
DROP POLICY IF EXISTS "closing_submissions_no_delete" ON public.closing_submissions;
CREATE POLICY "closing_submissions_no_delete" ON public.closing_submissions AS RESTRICTIVE FOR DELETE
  USING (get_my_internal_role() = 'director');
