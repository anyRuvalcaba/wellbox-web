-- T-001 (seguimiento) — Acota quién puede ejecutar las funciones security definer.
--
-- El linter de seguridad de Supabase marcó las cuatro funciones de 0003 como
-- ejecutables por `anon` vía /rest/v1/rpc/<nombre>. Postgres concede EXECUTE a PUBLIC
-- por defecto al crear una función, y Supabase expone el esquema public como API REST.
--
-- Ninguna era explotable —las de trigger fallan si se llaman fuera de un trigger, y
-- delete_incomplete_order compara contra auth.uid(), que es nulo sin sesión— pero
-- depender de eso es confiar en un accidente. Principio de mínimo privilegio: si nadie
-- necesita llamarlas desde la API, nadie debe poder.

-- Funciones de trigger: no las llama nadie por RPC. Postgres no revisa el permiso
-- EXECUTE cuando dispara un trigger, así que revocarlo no rompe el alta de perfiles
-- ni la protección de rol.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_role() from public, anon, authenticated;

-- is_admin() sí se evalúa dentro de las políticas RLS, y las políticas corren con los
-- permisos de quien consulta. Si `authenticated` perdiera EXECUTE, toda consulta de
-- admin fallaría. Se le quita solo a anon.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- delete_incomplete_order() la llama /api/orders con la sesión de la clienta.
revoke execute on function public.delete_incomplete_order(uuid) from public;
grant execute on function public.delete_incomplete_order(uuid) to authenticated;
