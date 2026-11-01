-- 126 already ran with the label "Capaian KPI Admin (%)"; spell it out.
-- (The code KPI_ADMIN is an internal key and stays.)
UPDATE public.payroll_activity_types
SET label = 'Capaian Kinerja Admin (%)'
WHERE code = 'KPI_ADMIN';
