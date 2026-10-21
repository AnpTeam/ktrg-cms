-- Supabase serves every table of the public schema through its own web API (PostgREST), guarded only by row level
-- security. The app never uses that API (it connects to Postgres directly, as the table owner, which ignores RLS), so
-- RLS is turned on with no policies: the outside API sees nothing, the app is unaffected.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
