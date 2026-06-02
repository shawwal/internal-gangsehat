-- 010_schedules.sql
-- Master schedule table for staff/therapist weekly work schedule

CREATE TABLE IF NOT EXISTS schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES internal_profiles(id) ON DELETE CASCADE,
  branch_id   uuid REFERENCES branches(id),
  hari        varchar(10) NOT NULL
                CHECK (hari IN ('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU','AHAD')),
  shift       varchar(10) NOT NULL
                CHECK (shift IN ('PAGI', 'SORE')),
  jam_mulai   time NOT NULL DEFAULT '09:00',
  jam_selesai time NOT NULL DEFAULT '17:00',
  status      varchar(10) NOT NULL DEFAULT 'AKTIF'
                CHECK (status IN ('AKTIF', 'OFF')),
  notes       text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (staff_id, hari, shift)
);

CREATE INDEX IF NOT EXISTS idx_schedules_staff_id  ON schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_schedules_branch_id ON schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedules_hari      ON schedules(hari);
CREATE INDEX IF NOT EXISTS idx_schedules_status    ON schedules(status);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Director: full access (branch_id = NULL signals cross-branch)
CREATE POLICY "schedules: director all"
  ON schedules FOR ALL
  USING (get_my_internal_role() = 'director')
  WITH CHECK (get_my_internal_role() = 'director');

-- HR: full access on own branch
CREATE POLICY "schedules: hr all own branch"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() = 'hr'
    AND branch_id = get_my_branch()
  )
  WITH CHECK (
    get_my_internal_role() = 'hr'
    AND branch_id = get_my_branch()
  );

-- Manager: full access on own branch
CREATE POLICY "schedules: manager all own branch"
  ON schedules FOR ALL
  USING (
    get_my_internal_role() = 'manager'
    AND branch_id = get_my_branch()
  )
  WITH CHECK (
    get_my_internal_role() = 'manager'
    AND branch_id = get_my_branch()
  );

-- Therapist + Staff: read-only on own branch
CREATE POLICY "schedules: therapist staff read"
  ON schedules FOR SELECT
  USING (
    get_my_internal_role() IN ('therapist', 'staff')
    AND branch_id = get_my_branch()
  );
