-- Read-only privilege assertions: no customer data is changed.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname <> 'setup_marketplace_profile'
  LOOP
    IF has_function_privilege('anon', f.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: browser can call privileged routine %', f.proname;
    END IF;
    IF NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: server cannot call %', f.proname;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.demand', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.demand', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: demand counters are browser writable';
  END IF;
  IF has_table_privilege('authenticated', 'public.learned_paths', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: private delivery-derived paths are browser readable';
  END IF;
  IF has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: role can be changed by a profile update';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.profiles', 'lat', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: location sharing was broken';
  END IF;
  RAISE NOTICE 'JUDGE-SECURITY PASSED';
END $$;