-- Reviewed activation after verified encrypted backup and explicit production approval.
-- Existing restrictive admin-only advertisement RLS is preserved.
-- No records/objects are updated or deleted by installation.
BEGIN;
GRANT UPDATE(media_path,media_type) ON public.advertisements TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;