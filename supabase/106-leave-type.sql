-- 106: leave_requests.leave_type — "Perizinan" now covers more than cuti.
-- Label only: approving a request does not write attendance (HR still enters
-- ABS codes in payroll). Existing rows default to CUTI.

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'CUTI';

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('TUGAS','TERLAMBAT','CUTI','SAKIT','TUKAR SHIFT','TUKAR OFF','IZIN BELAJAR'));
