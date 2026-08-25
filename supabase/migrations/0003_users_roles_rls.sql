-- T-001 — Usuarios, roles y corrección de políticas RLS
-- Spec: docs/specs/2026-08-24-security-usuarios-roles-rls.md
--
-- Antes de esta migración, doce políticas usaban `to authenticated using (true)`:
-- cualquier sesión autenticada podía administrar el catálogo, leer todos los pedidos
-- y cambiar los datos bancarios en `settings`. No era explotable porque no existía
-- registro público. Esta migración es requisito para abrirlo.

-- ─────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- is_admin()
--
-- security definer es obligatorio: si la función leyera `profiles` bajo las
-- políticas del usuario, la política de `profiles` tendría que consultarse a sí
-- misma para resolverse. search_path fijo evita que un search_path manipulado
-- resuelva `profiles` a otra tabla.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Alta automática de perfil al registrarse.
-- Corre dentro de la transacción de alta de auth.users: si falla, el registro
-- completo falla. Por eso no hace nada que pueda fallar por datos.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Anti-escalación de privilegios.
--
-- `role` vive en una tabla y no en raw_user_meta_data justamente porque ese
-- campo es escribible por el propio usuario desde el cliente. Este trigger
-- cierra el otro camino: un update directo con el token del usuario.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo significa que la petición no trae identidad de usuario: es el
  -- servidor (migraciones, editor SQL, service key). Esos contextos ya saltan RLS por
  -- definición, así que policiarlos aquí no agrega seguridad y sí impide crear al
  -- primer admin. Una petición `anon` tampoco llega a este trigger: la política de
  -- update sobre profiles es `to authenticated`, así que RLS la rechaza antes.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- profiles: cada quien ve y edita el suyo; el admin ve y edita todos.
-- No hay política de insert: el alta la hace handle_new_user (security definer).
create policy "read own profile or admin reads all" on profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile or admin updates all" on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- orders: ahora tienen dueño
--
-- La columna queda nullable a propósito: los pedidos anteriores al login no
-- tienen usuario (decisión AD-2 del spec). La obligatoriedad para pedidos
-- nuevos la impone la política de insert, que `null` no puede satisfacer.
-- ─────────────────────────────────────────────────────────────────────────

alter table orders add column user_id uuid references auth.users(id) on delete set null;
create index orders_user_id_idx on orders(user_id);

drop policy "public can create orders" on orders;
drop policy "authenticated read orders" on orders;
drop policy "authenticated update orders" on orders;

create policy "users create own orders" on orders
  for insert to authenticated with check (user_id = auth.uid());
create policy "users read own orders, admins read all" on orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins update orders" on orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- order_items / order_item_options: heredan el dueño a través de orders
drop policy "public can create order_items" on order_items;
drop policy "authenticated read order_items" on order_items;

create policy "users create items of own orders" on order_items
  for insert to authenticated with check (
    exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
create policy "users read items of own orders, admins read all" on order_items
  for select to authenticated using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy "public can create order_item_options" on order_item_options;
drop policy "authenticated read order_item_options" on order_item_options;

create policy "users create options of own orders" on order_item_options
  for insert to authenticated with check (
    exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id and o.user_id = auth.uid()
    )
  );
create policy "users read options of own orders, admins read all" on order_item_options
  for select to authenticated using (
    exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Catálogo y ajustes: administrar exige rol admin, no solo sesión.
-- Las políticas de lectura pública del menú publicado no cambian.
-- ─────────────────────────────────────────────────────────────────────────

drop policy "authenticated manage menus" on menus;
create policy "admins manage menus" on menus
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "authenticated manage menu_days" on menu_days;
create policy "admins manage menu_days" on menu_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "authenticated manage dishes" on dishes;
create policy "admins manage dishes" on dishes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "authenticated manage option_groups" on option_groups;
create policy "admins manage option_groups" on option_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy "authenticated manage option_choices" on option_choices;
create policy "admins manage option_choices" on option_choices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings guarda los datos bancarios. Antes: escribible por cualquier sesión
-- autenticada — es decir, redirigir los pagos de todas las clientas.
drop policy "authenticated manage settings" on settings;
create policy "admins manage settings" on settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lectura de settings: ya no hace falta que sea anónima, porque pedir exige login.
drop policy "public can read settings" on settings;
create policy "authenticated read settings" on settings
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Storage
-- ─────────────────────────────────────────────────────────────────────────

drop policy "authenticated manage dish photos" on storage.objects;
create policy "admins manage dish photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'dish-photos' and public.is_admin())
  with check (bucket_id = 'dish-photos' and public.is_admin());

-- Comprobantes de pago: antes cualquiera podía subir y cualquier sesión
-- autenticada podía leer los de todas las clientas.
drop policy "public upload payment proofs" on storage.objects;
drop policy "authenticated read payment proofs" on storage.objects;

create policy "users upload own payment proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and owner = auth.uid());
create policy "users read own payment proofs, admins read all" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (owner = auth.uid() or public.is_admin()));
