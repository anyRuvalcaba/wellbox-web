-- T-001 (seguimiento 2) — Completa lo que 0004 dejó a medias.
--
-- 0004 hizo `revoke execute ... from public` y el linter de Supabase siguió marcando
-- is_admin() y delete_incomplete_order() como llamables por anon.
--
-- La causa: Supabase tiene `alter default privileges in schema public grant execute on
-- functions to anon, authenticated, service_role`. Al crearse, cada función recibe un
-- permiso EXPLÍCITO a nombre de `anon`, además del implícito de PUBLIC. Revocar de
-- PUBLIC no toca el explícito — hay que revocar del rol por su nombre.
--
-- En 0004 las funciones de trigger sí quedaron bien porque ahí se revocó de
-- `public, anon, authenticated`. Estas dos solo perdieron el de PUBLIC.

revoke execute on function public.is_admin() from anon;
revoke execute on function public.delete_incomplete_order(uuid) from anon;

-- authenticated conserva el permiso a propósito en ambas: is_admin() se evalúa dentro
-- de las políticas RLS con los permisos de quien consulta, y delete_incomplete_order()
-- la llama /api/orders con la sesión de la clienta.
