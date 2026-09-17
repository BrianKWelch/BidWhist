-- League play needs NO new tables or columns. It reuses:
--   tournaments.rotation_type = 'league'      (alongside 'standard' and 'malt')
--   tournaments.malt_rounds   = number of weeks
--   matches.round             = week number
--   matches.table_number      = 1 for Side A, 2 for Side B
--   games                     = scores, exactly as tournaments use it
--
-- Run this ONLY if saving a tournament with Table Rotation = League fails with a
-- check-constraint error on rotation_type (that would mean the column was
-- created with a CHECK limited to 'standard' / 'malt'). Paste into the Supabase
-- SQL editor:

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tournaments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%rotation_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.tournaments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_rotation_type_check
  CHECK (rotation_type IS NULL OR rotation_type IN ('standard', 'malt', 'league'));
