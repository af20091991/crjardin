DO $do$
DECLARE r RECORD; src text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('get_shared_client','mark_shared_read','record_shared_report_view')
  LOOP
    src := pg_get_functiondef(r.oid);
    src := replace(src, 'status = ''termine''', 'status IN (''termine'',''terminee'')');
    src := replace(src, 'r.status IN (''en_attente'',''acceptee'')', 'r.status IN (''en_attente'',''acceptee'',''proposee'')');
    EXECUTE src;
  END LOOP;
END
$do$;