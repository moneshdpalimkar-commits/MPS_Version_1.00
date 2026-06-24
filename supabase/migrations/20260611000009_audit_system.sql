-- 20260611000009_audit_system.sql

-- Add `category` column to audit_logs for module-level filtering
ALTER TABLE public.audit_logs
  ADD COLUMN category TEXT;

-- Backfill `category` based on the existing `table_name`
UPDATE public.audit_logs SET category = CASE
  WHEN table_name = 'attendance' THEN 'attendance'
  WHEN table_name = 'leave_requests' THEN 'leave'
  WHEN table_name = 'payroll' THEN 'payroll'
  WHEN table_name = 'holidays' THEN 'holiday'
  WHEN table_name = 'announcements' THEN 'announcement'
  WHEN table_name = 'settings' THEN 'settings'
  ELSE 'system'
END;

-- Indexes for fast filtered queries
CREATE INDEX idx_audit_logs_category_created_at ON public.audit_logs(category, created_at DESC);
CREATE INDEX idx_audit_logs_table_name_created_at ON public.audit_logs(table_name, created_at DESC);

-- Row Level Security: principals can view logs for staff belonging to their school
-- Allow SELECT if:
--   • The current user is a principal and the audit log's user (if any) belongs to a staff member of the same school
--   • Or the audit log has no user_id (system actions)
CREATE POLICY "principals_view_own_school_audit_logs"
ON public.audit_logs
FOR SELECT
USING (
  auth.role() = 'authenticated'   -- ensure user is logged in
  AND (
    EXISTS (
      SELECT 1 FROM principals pr
      WHERE pr.user_id = auth.uid()
      AND (
        audit_logs.user_id IS NULL
        OR audit_logs.user_id IN (
          SELECT s.user_id FROM staff s WHERE s.school_id = pr.school_id
        )
      )
    )
  )
);

-- Enable RLS on the table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
