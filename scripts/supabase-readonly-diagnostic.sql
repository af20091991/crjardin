BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'migration_history_table_exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', table_schema, 'name', table_name) ORDER BY table_schema, table_name) FROM information_schema.tables WHERE table_schema IN ('public','storage') AND table_type='BASE TABLE'), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'position', ordinal_position, 'name', column_name, 'type', data_type, 'udt', udt_name, 'nullable', is_nullable, 'default', column_default) ORDER BY table_schema, table_name, ordinal_position) FROM information_schema.columns WHERE table_schema IN ('public','storage')), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', policyname, 'command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check) ORDER BY schemaname, tablename, policyname) FROM pg_policies WHERE schemaname IN ('public','storage')), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid, true)) ORDER BY n.nspname, c.relname, t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage')), '[]'::jsonb),
  'sst_related_functions', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'identity_arguments', pg_get_function_identity_arguments(p.oid), 'definition', pg_get_functiondef(p.oid)) ORDER BY n.nspname, p.proname, p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','storage') AND p.prokind IN ('f','p') AND p.proname ~* '(sst|subcontractor|worksite|calendar|photo|client_message|notification)'), '[]'::jsonb)
));
COMMIT;
