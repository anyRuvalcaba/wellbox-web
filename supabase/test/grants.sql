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
grant execute on all functions in schema public, auth to anon, authenticated;
