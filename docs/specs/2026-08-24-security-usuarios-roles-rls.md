# Spec: Usuarios, roles y corrección de políticas RLS

## Metadata
- **Tipo:** security-patch + feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** IN PROGRESS

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

Doce políticas —diez sobre tablas y dos sobre Storage— en
`supabase/migrations/0001_init.sql` están escritas así:

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

- [x] **CA-1** — Existe `profiles`, ligada 1:1 a `auth.users`, con `role` restringido a
      `customer | admin` y default `customer`.
- [x] **CA-2** — Al registrarse un usuario nuevo, su fila en `profiles` se crea
      automáticamente con rol `customer`.
- [x] **CA-3** — Un usuario autenticado con rol `customer` **no puede** modificar su
      propio `role`, ni por API ni por SQL directo con su token.
- [x] **CA-4** — Las doce políticas exigen rol `admin`, no solo sesión autenticada.
- [x] **CA-5** — Un `customer` puede leer únicamente sus propios pedidos.
- [x] **CA-6** — Un `admin` puede leer y actualizar todos los pedidos.
- [ ] **CA-7** — El registro público funciona end-to-end: alta, confirmación, login,
      logout.
- [ ] **CA-8** — `/admin/*` responde con redirección a login para un `customer`
      autenticado, no solo para usuarios anónimos.
- [x] **CA-9** — Existe una pantalla de administración de usuarios donde un `admin`
      puede ver la lista y cambiar roles.
- [x] **CA-10** — Los comprobantes en `payment-proofs` solo son legibles por `admin` y
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

Las diez políticas de tabla `to authenticated using (true)` se reemplazan por
equivalentes que exigen `public.is_admin()`, y las dos de Storage se acotan igual.

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

## Decisiones Resueltas

- **AD-1 — ¿Se permite pedir como invitado?** Hoy cualquiera puede crear un pedido sin
  cuenta. Si se exige login, el flujo queda más limpio, `orders.user_id` puede ser `not
  null` y el checkout se pre-llena del perfil; pero se pierde conversión de clientes que
  no se quieren registrar. Si se permite invitado, `user_id` queda nullable y hay que
  mantener dos caminos en el checkout. **RESUELTO 2026-08-24: se exige login.**
  `orders.user_id` se llena siempre en pedidos nuevos y se elimina la política que permitía a `anon`
  crear pedidos.
- **AD-2 (RESUELTO) — Pedidos históricos.** Nota: por esto la columna queda *nullable*
  en el DDL. La obligatoriedad se aplica en la política de `insert`
  (`with check (user_id = auth.uid())`), que es imposible de satisfacer con `null`.
  Declararla `not null` haría fallar la migración con los pedidos que ya existen. Los pedidos ya existentes quedan con `user_id` nulo. Se
  propone dejarlos así (visibles solo para admin) en lugar de intentar ligarlos por
  teléfono.

## Dependencias

- Internas: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `proxy.ts`,
  `app/admin/(dashboard)/layout.tsx`, `app/api/orders/route.ts`
- Externas: ninguna nueva. `@supabase/ssr` ya cubre el manejo de sesión.

## Riesgos y Deuda Técnica

- La migración toca las doce políticas existentes. Un error aquí no rompe el build:
  se manifiesta como datos accesibles o inaccesibles en runtime. **Mitigación:** las
  pruebas de CA-3, CA-4 y CA-5 se escriben antes de aplicar la migración a producción.
- `handle_new_user` se dispara dentro de la transacción de alta de `auth.users`. Si
  falla, el registro completo falla. Debe ser mínimo y no depender de nada externo.

## Pendientes Abiertos y Gaps Detectados

**Bug encontrado y corregido durante la implementación — bootstrap del primer admin.**
La primera versión de `protect_role()` revertía cualquier cambio de `role` cuando
`is_admin()` era falso. En un contexto de servidor (migración, editor SQL, service key)
`auth.uid()` es nulo, así que `is_admin()` devolvía falso y **el trigger se bloqueaba a
sí mismo**: no existía forma de crear la primera cuenta admin.

Corrección: el trigger solo vigila peticiones que traen identidad de usuario
(`auth.uid() is not null`). Los contextos de servidor ya saltan RLS por definición, y
una petición `anon` no alcanza el trigger porque la política de update sobre `profiles`
es `to authenticated`. Se agregó la prueba `ANON OK` para verificar justamente que ese
camino no es explotable desde el cliente.

Lo detectó el entorno local de pruebas antes de tocar cualquier base real.

**Pendiente de la fase de aplicación:** la cuenta admin actual del equipo queda como
`customer` al correr la migración. Hay que promoverla a mano desde el editor SQL de
Supabase:
```sql
update profiles set role = 'admin' where id = '<uuid de la cuenta>';
```

**Fuera de alcance de T-001 (va en T-002):** `profiles.delivery_location_id` y su
trigger de inmutabilidad.

## Resultados

- **Fecha de cierre:** 2026-08-24 (implementación); verificación en Supabase pendiente
- **Rama:** `security/usuarios-roles-rls`

### CAs cubiertos por prueba automatizada (`npm run db:verify`)

CA-2, CA-3, CA-4, CA-5, CA-6, más dos controles que no estaban en el spec original y
salieron del modelado STRIDE: que no se pueda crear un pedido a nombre ajeno
(*spoofing*), y que el escape de servidor de `protect_role()` no sea explotable desde
una sesión anónima.

### CAs implementados pero NO verificados todavía

| CA | Qué falta |
|---|---|
| CA-1 | La tabla existe y las pruebas la usan, pero no se ha creado en Supabase |
| CA-7 | Registro end-to-end: requiere Supabase Auth, que no corre en el Postgres local |
| CA-8 | `/admin` con sesión de cliente: `requireAdmin()` lo implementa; falta probarlo vivo |
| CA-9 | La pantalla compila y consulta `profiles`; falta verla con datos reales |
| CA-10 | Las políticas de Storage están escritas; el shim local no simula Storage |

**El bloqueo es el mismo para todos: el proyecto de Supabase está pausado.** El entorno
local reproduce Postgres y RLS, no Auth ni Storage, que son servicios de Supabase.

### Deuda técnica generada

`POST /api/orders` sigue insertando el pedido y sus renglones en llamadas separadas, sin
transacción. Antes de esta migración, el rollback era un `delete` directo; ahora las
políticas ya no permiten borrar pedidos, así que se agregó
`delete_incomplete_order()` — una función acotada que solo borra un pedido propio y sin
renglones. **Es un parche.** La solución real es que crear el pedido sea una sola
transacción del lado de Postgres, y queda en T-003, donde de todas formas hace falta
para descontar stock de forma atómica.

### Cambios de alcance durante la implementación

- `profiles` ganó la columna `email`, copiada de `auth.users`, porque la pantalla de
  administración de usuarios (CA-9) necesita mostrarla y `auth.users` no es legible con
  la anon key desde el cliente.
- El login de admin y el de clientas se unificaron en `/login`, con redirección según
  rol. `/admin/login` redirige ahí para no romper el enlace que el equipo ya tiene.
- La lectura de `settings` dejó de ser anónima: pedir ahora exige cuenta, así que no hay
  razón para exponer los datos bancarios sin sesión.

### Lecciones aprendidas

El entorno local de Postgres se pagó solo el mismo día: detectó que `protect_role()` se
bloqueaba a sí misma e impedía crear el primer admin. Ese bug habría aparecido en la base
real, como un `update` que "funciona" pero no cambia nada.
