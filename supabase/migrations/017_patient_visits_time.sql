-- Add visit_time to patient_visits so the daily schedule grid can show
-- visits at specific time slots (e.g. 09:30).
-- The column is nullable — existing visits without a time will still display
-- (grouped at the top of each staff column as "unscheduled").

ALTER TABLE public.patient_visits
  ADD COLUMN IF NOT EXISTS visit_time time;

-- Index helps the daily schedule query filter by date + order by time
CREATE INDEX IF NOT EXISTS idx_patient_visits_date_time
  ON public.patient_visits (visit_date, visit_time);
