-- Create System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gps_radius_meters integer NOT NULL DEFAULT 150,
  session_timeout_hours integer NOT NULL DEFAULT 24,
  backup_interval text NOT NULL DEFAULT 'daily',
  updated_at timestamp with time zone DEFAULT now()
);

-- Seed default settings row
INSERT INTO public.system_settings (gps_radius_meters, session_timeout_hours, backup_interval)
VALUES (150, 24, 'daily')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow all authenticated users to read settings
CREATE POLICY "Allow read system_settings for authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- Update policy: Allow only superadmin users to update settings
CREATE POLICY "Allow update system_settings for superadmin"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.id = auth.uid() AND staff.staff_role = 'superadmin'
    )
  );
