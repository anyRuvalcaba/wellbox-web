# Spec: Perfil, punto de entrega y métodos de pago

## Metadata
- **Tipo:** feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** IN PROGRESS

## Historia

Como **clienta de WellBox**, quiero tener un perfil con mis datos, mi punto de entrega y
mis formas de pago guardadas, para no volver a capturarlos en cada pedido.

Como **administradora**, quiero saber cuántas clientas y cuántas entregas hay en cada
punto, para planear la logística de cada mañana.

## Contexto

T-001 dejó `profiles` con nombre, teléfono y rol. Falta el resto de lo que el checkout
pide cada vez: a dónde se entrega y cómo se paga.

Hoy el pago es solo transferencia con comprobante, y la entrega no se modela — la tabla
`orders` tiene `delivery_type` y `delivery_address` heredados del andamiaje inicial, que
nunca se usaron de verdad.

## Puntos de entrega

WellBox **no entrega a domicilio**. Hay tres puntos fijos y cada clienta queda asociada
a uno: es su lugar de trabajo, así que no cambia entre pedidos.

Esto reemplaza el modelo `Address` del proyecto del curso (calle, ciudad, estado, código
postal, país, tipo de domicilio). No se adopta porque no aplica: modelar direcciones
libres cargaría validación, errores de captura y ambigüedad de cobertura para un negocio
que entrega en tres oficinas conocidas.

Beneficio operativo: la asociación clienta ↔ punto permite contar clientas y entregas por
punto con una sola consulta agregada, sin tabla extra.

## Métodos de pago

Tres tipos: `card`, `cash`, `transfer`.

**Decisión de diseño — no se guardan datos completos de tarjeta.** El proyecto del curso
(`ecommerce-api/src/models/PaymentMethod.js`) guarda `cardNumber` y `cvv` en texto plano.
PCI-DSS prohíbe almacenar el CVV incluso cifrado, incluso por un instante. WellBox guarda
solo marca y últimos cuatro dígitos, como referencia visual para que la clienta reconozca
cuál tarjeta es.

## Criterios de Aceptación

- [x] **CA-1** — Existe `delivery_locations` con los tres puntos, administrable por admin.
- [x] **CA-2** — Al registrarse, la clienta elige su punto de entrega y queda asociado.
- [x] **CA-3** — La clienta **no puede** cambiar su punto una vez fijado; un admin sí.
- [x] **CA-4** — El primer valor sí lo puede fijar ella (sin esto el registro no cierra).
- [x] **CA-5** — La clienta ve y edita su nombre y teléfono en `/pedido/perfil`.
- [x] **CA-6** — Puede registrar métodos de pago: efectivo, transferencia y tarjeta.
- [x] **CA-7** — De una tarjeta se guardan solo marca y últimos 4; **nunca CVV ni PAN**.
- [x] **CA-8** — Una clienta solo ve y edita sus propios métodos de pago.
- [ ] **CA-9** — El checkout deja elegir método de pago entre los suyos.
- [ ] **CA-10** — El pedido guarda copia del nombre del punto de entrega y del método.
- [ ] **CA-11** — El admin ve cuántas clientas y cuántas entregas hay por punto.

## Consideraciones de Seguridad

| Amenaza | Escenario | Control |
|---|---|---|
| **I**nformation Disclosure | Una clienta lee los métodos de pago de otra | RLS en `payment_methods` filtrada por `user_id = auth.uid()` (CA-8) |
| **I**nformation Disclosure | Fuga de la base expone datos de tarjeta | No se almacenan: solo marca y últimos 4 (CA-7) |
| **T**ampering | Una clienta se cambia de punto de entrega para colarse en otra ruta | Trigger de inmutabilidad, mismo patrón que `protect_role` (CA-3) |
| **T**ampering | Se manda un `payment_method_id` ajeno en el pedido | El servidor valida que el método pertenezca a `auth.uid()` |
| **E**levation of Privilege | Una clienta edita los puntos de entrega | `delivery_locations`: lectura para autenticados, escritura solo `is_admin()` |

## Diseño propuesto

```sql
create table delivery_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  notes text,
  is_active boolean not null default true,
  position int not null default 0
);

alter table profiles add column delivery_location_id uuid references delivery_locations(id);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('card','cash','transfer')),
  label text,                    -- "Mi BBVA", "Efectivo"
  card_brand text,               -- visa | mastercard | amex
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table orders add column delivery_location_id uuid references delivery_locations(id) on delete set null;
alter table orders add column delivery_location_name text;   -- snapshot
alter table orders add column payment_method_id uuid references payment_methods(id) on delete set null;
alter table orders add column payment_method_label text;     -- snapshot
```

**Por qué los snapshots.** Si un admin cambia el punto de entrega de una clienta, o ella
borra una tarjeta, los pedidos anteriores deben seguir mostrando dónde se entregaron y
cómo se pagaron. Es el mismo criterio que ya usa `order_items` con `dish_name` y
`unit_price`.

**Sin columnas para CVV ni número completo.** No es un olvido: es la decisión. Una columna
que no existe no se puede llenar por accidente.

## Decisiones Abiertas

- **AD-1 (RESUELTO 2026-08-24) — Por ahora, registro de intención.** La clienta indica
  con qué tarjeta pagará y el cobro ocurre fuera de la app. Igual que el proyecto del
  curso, cuyo `createOrder` tampoco cobra nada.

  Se evaluó Stripe **en modo de prueba** —que no requiere cuenta de comercio ni trámites
  fiscales, y permite un flujo real con tarjetas de prueba— y se pospuso: los pendientes
  fiscales del negocio siguen abiertos. Queda como trabajo futuro, y no obliga a rehacer
  nada: el método de pago ya es una entidad propia del modelo.

  Alternativas consideradas originalmente:
  1. **Pasarela real** (Stripe / Mercado Pago): cobro de verdad. Alcance grande, requiere
     cuenta de comercio y manejo de webhooks.
  2. **Registro de intención**: la clienta indica que pagará con tarjeta y el cobro ocurre
     fuera de la app (terminal al entregar). Alcance chico, refleja la operación real.
  3. **Pasarela simulada**: se finge la autorización para demostrar el flujo completo.
  Sin resolver.

## Dependencias

- Internas: `profiles` y las políticas de T-001; `app/api/orders/route.ts`;
  `app/(auth)/registro`; `app/pedido/resumen` y `app/pedido/pago`.
- Externas: ninguna, salvo que AD-1 resuelva pasarela real.

## Riesgos y Deuda Técnica

- `orders.delivery_type` y `orders.delivery_address` quedan obsoletos. No se eliminan en
  esta migración: los 3 pedidos históricos los tienen llenos. Se marcan como muertos y su
  baja se evalúa después.
- `payment_methods` con `is_default` por usuario necesita garantizar que solo haya uno
  activo. Se resuelve con índice único parcial, no con lógica de aplicación.

## Pendientes Abiertos y Gaps Detectados

**Verificado en producción (2026-08-24):** migraciones 0007, 0008 y 0009 aplicadas por
conexión directa. Se probó en el navegador contra la base real: alta de punto de entrega,
intento de cambiarlo (revertido por el trigger), alta de dos tarjetas y cambio de
predeterminada, dejando exactamente una.

**Cambio de alcance — lectura pública de los puntos de entrega (0008).** La pantalla de
registro necesita listarlos y ahí todavía no hay sesión. Se abrió la lectura de los
puntos **activos** únicamente; los inactivos siguen ocultos y escribirlos sigue
exigiendo rol admin. No es información sensible: es dónde entrega WellBox.

**Cambio de alcance — cambiar el predeterminado es una función de Postgres (0009).** Son
dos operaciones y el índice único parcial impide que ambas tarjetas lo tengan a la vez,
así que hechas por separado un fallo intermedio deja a la clienta sin ninguna
predeterminada.

**Hueco cubierto — `SelectorPunto`.** Las cuentas creadas antes de 0007 no tienen punto
asignado, y con la confirmación por correo activada el alta no deja sesión para
escribirlo. El perfil permite fijarlo cuando está vacío.

**Pendiente de esta fase:** CA-9 (elegir método en el checkout), CA-10 (copia en el
pedido) y CA-11 (reporte de clientas y entregas por punto).

## Resultados

> Se completa al cerrar.
