-- Link activity_logs rows to the patient they concern, so the activity log
-- page can show everything that happened to one patient (profile edits,
-- visits, transactions, Griya Anak slots) regardless of resource_type.
-- Filled by lib/activityLog.ts's logActivity(). No FK on purpose: the audit
-- trail must keep pointing at the patient even if the patient row is removed.

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS patient_id uuid;

CREATE INDEX IF NOT EXISTS activity_logs_patient_created_idx
  ON public.activity_logs (patient_id, created_at DESC)
  WHERE patient_id IS NOT NULL;

-- ── Backfill existing rows ─────────────────────────────────────────────────

-- Patient rows: resource_id is the patient id.
UPDATE public.activity_logs al
SET patient_id = al.resource_id::uuid
WHERE al.patient_id IS NULL
  AND al.resource_type = 'patient'
  AND al.resource_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Rows whose logged values carry patient_id (most transaction rows,
-- including deleted ones).
UPDATE public.activity_logs al
SET patient_id = COALESCE(al.new_values->>'patient_id', al.old_values->>'patient_id')::uuid
WHERE al.patient_id IS NULL
  AND COALESCE(al.new_values->>'patient_id', al.old_values->>'patient_id')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.activity_logs al
SET patient_id = v.patient_id
FROM public.patient_visits v
WHERE al.patient_id IS NULL
  AND al.resource_type = 'patient_visit'
  AND v.id::text = al.resource_id;

UPDATE public.activity_logs al
SET patient_id = t.patient_id
FROM public.transactions t
WHERE al.patient_id IS NULL
  AND al.resource_type = 'transaction'
  AND t.patient_id IS NOT NULL
  AND t.id::text = al.resource_id;

UPDATE public.activity_logs al
SET patient_id = s.patient_id
FROM public.griya_schedule_slots s
WHERE al.patient_id IS NULL
  AND al.resource_type = 'griya_slot'
  AND s.id::text = al.resource_id;

-- setGriyaStudentStatus logs under griya_slot with the patient id as resource_id.
UPDATE public.activity_logs al
SET patient_id = p.id
FROM public.patients p
WHERE al.patient_id IS NULL
  AND al.resource_type = 'griya_slot'
  AND p.id::text = al.resource_id;
