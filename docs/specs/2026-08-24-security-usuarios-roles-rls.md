# Spec: Usuarios, roles y corrección de políticas RLS

## Metadata
- **Tipo:** security-patch + feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** DRAFT

## Historia

Como **cliente de WellBox**, quiero registrarme con correo y contraseña para tener mi
perfil y ver mis pedidos anteriores, sin que eso me dé acceso a la información de otros
clientes ni al panel de administración.

Como **administradora de WellBox**, quiero que solo las cuentas marcadas como `admin`
puedan editar menús, ver todos los pedidos y cambiar ajustes.

## Contexto

Hoy WellBox solo tiene login de administrador. Los usuarios se crean a mano en el
dashboard de Supabase y no existe registro público. Los pedidos se hacen como invitado:
solo se capturan `customer_name` y `customer_phone` en el checkout.

Para cumplir el entregable "login y registro operativos" hay que abrir el registro
público. **Hacerlo sin este spec introduciría una escalación de privilegios**, por lo
descrito abajo.

## El problema de seguridad actual

Las nueve políticas de escritura en `supabase/migrations/0001_init.sql` están escritas así:

```sql
create policy "authenticated manage menus" on menus
  for all to authenticated using (true) with check (true);
```

`to authenticated` significa *cualquier sesión autenticada*, sin distinguir rol. Hoy no
es explotable porque las únicas cuentas que existen son las del equipo. En el momento en
que exista `POST /auth/signup` público, cualquier persona que se registre podría:

- editar y borrar menús, platillos y opciones (`menus`, `menu_days`, `dishes`,
  `option_groups`, `option_choices`)
- leer **todos** los pedidos, con nombre y teléfono de todos los clientes
- cambiar los datos bancarios en `settings` — es decir, redirigir los pagos por
  transferencia de todos los clientes a otra cuenta

Las tablas afectadas son las nueve que tienen RLS activo, más las políticas de Storage
sobre `payment-proofs` (comprobantes de pago con datos bancarios de clientes).

## Criterios de Aceptación

- [ ] **CA-1** — Existe `profiles`, ligada 1:1 a `auth.users`, con `role` restringido a
      `customer | admin` y default `customer`.
- [ ] **CA-2** — Al registrarse un usuario nuevo, su fila en `profiles` se crea
      automáticamente con rol `customer`.
- [ ] **CA-3** — Un usuario autenticado con rol `customer` **no puede** modificar su
      propio `role`, ni por API ni por SQL directo con su token.
- [ ] **CA-4** — Las nueve políticas de escritura exigen rol `admin`, no solo sesión
      autenticada.
- [ ] **CA-5** — Un `customer` puede leer únicamente sus propios pedidos.
- [ ] **CA-6** — Un `admin` puede leer y actualizar todos los pedidos.
- [ ] **CA-7** — El registro público funciona end-to-end: alta, confirmación, login,
      logout.
- [ ] **CA-8** — `/admin/*` responde con redirección a login para un `customer`
      autenticado, no solo para usuarios anónimos.
- [ ] **CA-9** — Existe una pantalla de administración de usuarios donde un `admin`
      puede ver la lista y cambiar roles.
- [ ] **CA-10** — Los comprobantes en `payment-proofs` solo son legibles por `admin` y
      por el dueño del pedido.

## Consideraciones de Seguridad

Amenazas STRIDE identificadas:

| Amenaza | Escenario | Control |
|---|---|---|
| **E**levation of Privilege | Un `customer` hace `update profiles set role='admin'` con su propio token | Trigger `BEFORE UPDATE` que revierte cambios de `role` si quien ejecuta no es admin (CA-3) |
| **E**levation of Privilege | Un `customer` autenticado edita menús o `settings` | Políticas basadas en `is_admin()` en lugar de `to authenticated` (CA-4) |
| **I**nformation Disclosure | Un `customer` lee pedidos y teléfonos de otros clientes | Política de `orders` filtrada por `user_id = auth.uid()` (CA-5) |
| **I**nformation Disclosure | Un `customer` lista los comprobantes de pago del bucket privado | Política de Storage por dueño del objeto + admin (CA-10) |
| **S**poofing | El cliente manda un `user_id` ajeno en el body del pedido | El servidor toma la identidad de `auth.uid()`, nunca del body |
| **T**ampering | Escalación vía `is_admin()` recursivo sobre `profiles` con RLS | La función se declara `security definer` con `search_path` fijo |

Secrets involucrados: ninguno nuevo. Se sigue usando la `anon key` pública; el control
real queda en RLS.

## Diseño propuesto

```sql
-- 1. profiles, ligada a auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

-- 2. is_admin(): security definer para no recursar sobre las políticas de profiles
create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- 3. alta automática de perfil al registrarse
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
    return new;
  end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. blindaje contra auto-escalación de rol
create function public.protect_role() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    if new.role is distinct from old.role and not public.is_admin() then
      new.role := old.role;
    end if;
    return new;
  end;
$$;
create trigger profiles_protect_role before update on profiles
  for each row execute function public.protect_role();

-- 5. orders gana dueño
alter table orders add column user_id uuid references auth.users(id) on delete set null;
```

Las nueve políticas `for all to authenticated using (true)` se reemplazan por
`for all to authenticated using (public.is_admin()) with check (public.is_admin())`.

## Decisiones de Diseño

**`profiles` separada de `auth.users`, no metadata en el JWT.** Supabase permite guardar
el rol en `raw_user_meta_data`, que viaja dentro del token. Se descartó: ese campo es
escribible por el propio usuario desde el cliente, así que el rol sería auto-asignable.
Una tabla con RLS y un trigger de protección no tiene esa superficie.

**`is_admin()` como `security definer`.** Si la función leyera `profiles` bajo las
políticas del usuario, la política de `profiles` tendría que consultarse a sí misma para
resolverse — recursión infinita. `security definer` con `search_path` fijo es el patrón
documentado de Supabase para este caso.

**Trigger en lugar de política para proteger `role`.** Una política `with check` que
compare contra el valor anterior de la fila requiere subconsulta sobre la misma tabla
que se está evaluando. El trigger revierte el cambio de forma determinista y es
verificable con una prueba directa.

## Decisiones Abiertas

- **AD-1 — ¿Se permite pedir como invitado?** Hoy cualquiera puede crear un pedido sin
  cuenta. Si se exige login, el flujo queda más limpio, `orders.user_id` puede ser `not
  null` y el checkout se pre-llena del perfil; pero se pierde conversión de clientes que
  no se quieren registrar. Si se permite invitado, `user_id` queda nullable y hay que
  mantener dos caminos en el checkout. **Recomendación: exigir login**, por el entregable
  "login y registro operativos" y porque simplifica CA-5.
- **AD-2 — Pedidos históricos.** Los pedidos ya existentes quedan con `user_id` nulo. Se
  propone dejarlos así (visibles solo para admin) en lugar de intentar ligarlos por
  teléfono.

## Dependencias

- Internas: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `proxy.ts`,
  `app/admin/(dashboard)/layout.tsx`, `app/api/orders/route.ts`
- Externas: ninguna nueva. `@supabase/ssr` ya cubre el manejo de sesión.

## Riesgos y Deuda Técnica

- La migración toca las nueve políticas existentes. Un error aquí no rompe el build:
  se manifiesta como datos accesibles o inaccesibles en runtime. **Mitigación:** las
  pruebas de CA-3, CA-4 y CA-5 se escriben antes de aplicar la migración a producción.
- `handle_new_user` se dispara dentro de la transacción de alta de `auth.users`. Si
  falla, el registro completo falla. Debe ser mínimo y no depender de nada externo.

## Pendientes Abiertos y Gaps Detectados

> Se completa durante la implementación.

## Resultados

> Se completa al cerrar.
