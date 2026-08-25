-- ⚠️  SOLO PARA PRUEBAS LOCALES.
--
-- Supabase otorga estos permisos automáticamente a `anon` y `authenticated`. Sin
-- ellos, Postgres rechaza la consulta por permisos ANTES de llegar a evaluar RLS, y
-- las pruebas darían "permission denied" en vez de probar lo que queremos probar.
--
-- Corre DESPUÉS de las migraciones, porque `all tables` solo alcanza a las tablas
-- que ya existen.

grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema storage to anon, authenticated;
-- Solo auth: en el esquema public, Postgres ya concede EXECUTE a PUBLIC por defecto al
-- crear una función. Justamente por eso el linter de Supabase avisa, y por eso la
-- migración 0004 revoca. Si aquí se volviera a conceder, la prueba de 0004 sería falsa.
grant execute on all functions in schema auth to anon, authenticated;
