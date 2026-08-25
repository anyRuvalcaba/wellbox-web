-- T-002 — Puntos de entrega y métodos de pago.
-- Spec: docs/specs/2026-08-24-feature-perfil-entrega-pagos.md

-- ─────────────────────────────────────────────────────────────────────────
-- Puntos de entrega
--
-- WellBox no entrega a domicilio: hay tres puntos fijos y cada clienta queda asociada
-- a uno, porque es su lugar de trabajo. Esto reemplaza el modelo de direcciones libres
-- (calle, ciudad, estado, código postal, país) del proyecto del curso, que no aplica a
-- este negocio y solo traería validación y errores de captura.
-- ─────────────────────────────────────────────────────────────────────────

create table delivery_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  notes text,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table delivery_locations enable row level security;

-- Las clientas necesitan leerlos para elegir al registrarse; solo admin los edita.
create policy "authenticated read delivery locations" on delivery_locations
  for select to authenticated using (true);
create policy "admins manage delivery locations" on delivery_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into delivery_locations (name, address, notes, position) values
  ('Poder Judicial — Edificio Penal', 'Poder Judicial del Estado, Edificio Penal', null, 0),
  ('Poder Judicial — Edificio Sur',   'Poder Judicial del Estado, Edificio Sur',   null, 1),
  ('Semtech — Monte Blanco',          'Semtech, Monte Blanco',                     null, 2);

-- ─────────────────────────────────────────────────────────────────────────
-- Asociación clienta ↔ punto de entrega
-- ─────────────────────────────────────────────────────────────────────────

alter table profiles add column delivery_location_id uuid references delivery_locations(id);

-- El punto de entrega es el lugar de trabajo: se elige una vez y no cambia. La clienta
-- puede fijarlo cuando está vacío (sin esa excepción no podría terminar de registrarse),
-- pero no cambiarlo después. Solo un admin puede moverlo.
--
-- Mismo patrón y mismo motivo que protect_role(): auth.uid() nulo significa contexto de
-- servidor, que ya salta RLS por definición.
create or replace function public.protect_delivery_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.delivery_location_id is distinct from old.delivery_location_id
     and old.delivery_location_id is not null
     and auth.uid() is not null
     and not public.is_admin() then
    new.delivery_location_id := old.delivery_location_id;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_delivery_location
  before update on public.profiles
  for each row execute function public.protect_delivery_location();

revoke execute on function public.protect_delivery_location() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Métodos de pago
--
-- Aquí NO hay columna para el número de tarjeta ni para el CVV, y no es un olvido.
-- PCI-DSS prohíbe almacenar el CVV incluso cifrado. Y sin pasarela de pago, el número
-- completo no tiene nada que hacer en este servidor: pedirlo solo crearía riesgo a
-- cambio de nada. Se guardan marca y últimos cuatro dígitos, que es lo único que la
-- clienta necesita para reconocer cuál es su tarjeta.
--
-- El modelo del curso (ecommerce-api/src/models/PaymentMethod.js) guarda cardNumber y
-- cvv en texto plano. Una columna que no existe no se puede llenar por accidente.
-- ─────────────────────────────────────────────────────────────────────────

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('card', 'cash', 'transfer')),
  label text,
  card_brand text check (card_brand in ('visa', 'mastercard', 'amex', 'otra')),
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),

  -- Una tarjeta sin marca ni últimos 4 no sirve para distinguirla de otra.
  constraint tarjeta_identificable check (
    type <> 'card' or (card_brand is not null and card_last4 is not null)
  ),
  -- Y efectivo o transferencia no traen datos de tarjeta.
  constraint sin_datos_de_tarjeta_si_no_es_tarjeta check (
    type = 'card' or (card_brand is null and card_last4 is null)
  )
);

create index payment_methods_user_id_idx on payment_methods(user_id);

-- Un solo método predeterminado por usuario, garantizado por la base y no por lógica de
-- aplicación, que es donde se cuelan las condiciones de carrera.
create unique index payment_methods_un_solo_default
  on payment_methods(user_id) where is_default;

alter table payment_methods enable row level security;

-- La regla de propiedad vive aquí, no en cada endpoint. En el proyecto del curso esta
-- comprobación se repite en cada controlador, y en updatePaymentMethod y
-- deletePaymentMethod se les fue: cualquier sesión puede modificar o borrar el método de
-- pago de otra persona conociendo su id. Con una política de tabla no hay dónde
-- olvidarlo.
create policy "users read own payment methods" on payment_methods
  for select to authenticated using (user_id = auth.uid());
create policy "users create own payment methods" on payment_methods
  for insert to authenticated with check (user_id = auth.uid());
create policy "users update own payment methods" on payment_methods
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own payment methods" on payment_methods
  for delete to authenticated using (user_id = auth.uid());

-- Nota deliberada: el admin NO puede leer los métodos de pago de las clientas. No los
-- necesita para operar y no tenerlos es una superficie menos.

-- ─────────────────────────────────────────────────────────────────────────
-- El pedido guarda copia de dónde se entregó y cómo se pagó
--
-- Si un admin mueve a una clienta de punto, o ella borra una tarjeta, los pedidos
-- anteriores deben seguir diciendo la verdad. Mismo criterio que order_items con
-- dish_name y unit_price.
-- ─────────────────────────────────────────────────────────────────────────

alter table orders add column delivery_location_id uuid references delivery_locations(id) on delete set null;
alter table orders add column delivery_location_name text;
alter table orders add column payment_method_id uuid references payment_methods(id) on delete set null;
alter table orders add column payment_method_label text;

-- delivery_type y delivery_address quedan sin uso: venían del andamiaje inicial y nunca
-- reflejaron la operación real. No se eliminan todavía porque los pedidos históricos los
-- tienen llenos; su baja se evalúa por separado.
comment on column orders.delivery_type is 'OBSOLETO desde 0007 — usar delivery_location_id';
comment on column orders.delivery_address is 'OBSOLETO desde 0007 — usar delivery_location_name';
