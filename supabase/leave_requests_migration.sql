-- leave_requests table migration
-- Safe to re-run. Run this in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid        NOT NULL REFERENCES public.internal_profiles(id),
  branch_id      uuid        REFERENCES public.branches(id),
  start_date     date        NOT NULL,
  end_date       date        NOT NULL,
  reason         text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note text,
  reviewed_by    uuid        REFERENCES public.internal_profiles(id),
  reviewed_at    timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Make branch_id nullable if the column was previously created as NOT NULL
ALTER TABLE public.leave_requests ALTER COLUMN branch_id DROP NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own leave requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'staff_own_leave'
  ) THEN
    CREATE POLICY "staff_own_leave" ON public.leave_requests
      FOR ALL USING (staff_id = auth.uid());
  END IF;
END $$;

-- HR and Director can manage all leave requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'hr_director_all_leave'
  ) THEN
    CREATE POLICY "hr_director_all_leave" ON public.leave_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.internal_profiles
          WHERE id = auth.uid() AND role IN ('hr', 'director')
        )
      );
  END IF;
END $$;
