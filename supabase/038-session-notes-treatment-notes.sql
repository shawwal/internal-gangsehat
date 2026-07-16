-- Add free-text rich-text notes field for interventions performed today,
-- shown below the "Tindakan yang Dilakukan" checkboxes on the session note form.

ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS treatment_notes text;
