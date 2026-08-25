# Backlog — WellBox

Fuente de verdad del trabajo pendiente. Un ítem = un spec = una rama = un PR.

Cada fase se mapea a un entregable de la evaluación técnica del curso
(app en producción, repo, pruebas ejecutables, defensa verbal).

| ID | Fase | Estado | Entregable que cubre |
|---|---|---|---|
| T-001 | Usuarios, roles y RLS | SPEC DRAFT | Login y registro operativos |
| T-002 | Perfil, punto de entrega y métodos de pago | PENDIENTE | Checkout completo |
| T-003 | Stock y carrito | PENDIENTE | Carrito completo |
| T-004 | Manejo de errores y resiliencia | PENDIENTE | Rúbrica: resiliencia |
| T-005 | Suite de pruebas con Vitest | PENDIENTE | `npm test` en verde |
| T-006 | README y `npm audit` | PENDIENTE | Calidad del repositorio |
| T-007 | Deploy a Vercel y repo público | PENDIENTE | URL pública con SSL |

---

## T-002 — Perfil, punto de entrega y métodos de pago

### Puntos de entrega (reemplaza el modelo de direcciones libres)

WellBox **no entrega a domicilio**. Hay tres puntos de entrega fijos, y cada cliente
queda asociado a uno solo: es su lugar de trabajo, así que no cambia entre pedidos.

Esto **reemplaza** el modelo `Address` del proyecto de clase (calle, ciudad, estado,
código postal, país, teléfono, tipo). No se adopta ese modelo porque no aplica al
negocio.

Modelo propuesto:

```sql
create table delivery_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- ej. "Torre Zaragoza"
  address text not null,           -- referencia para el repartidor
  notes text,                      -- ej. "entrega en recepción"
  is_active boolean not null default true,
  position int not null default 0
);

alter table profiles add column delivery_location_id uuid references delivery_locations(id);
alter table orders   add column delivery_location_id uuid references delivery_locations(id) on delete set null;
alter table orders   add column delivery_location_name text;  -- snapshot
```

**Por qué el snapshot en `orders`:** si una clienta cambia de trabajo y actualiza su
punto de entrega, sus pedidos anteriores deben seguir mostrando dónde se entregaron
realmente. Es el mismo criterio que ya usa `order_items` con `dish_name` y `unit_price`.

**Beneficio operativo pedido explícitamente:** con la asociación usuario ↔ punto se
puede contar cuántos clientes y cuántas entregas hay por punto. Sale de una sola
consulta agregada; no requiere tabla extra.

**Decisión abierta AD-3 — ¿el punto de entrega es inmutable?** El requisito dice que no
cambia porque es el lugar de trabajo. Se puede aplicar de dos formas:
1. Inmutable en la base: una vez elegido, solo un admin lo cambia.
2. Editable por la clienta desde su perfil, con el pedido guardando el snapshot.

**Recomendación: opción 2.** "No cambia" es una expectativa de negocio, no una
invariante — la gente cambia de trabajo. Con la opción 1, cada cambio de empleo se
convierte en un ticket de soporte. El snapshot en `orders` ya protege el historial, que
es la razón real por la que importaba la inmutabilidad.

### Métodos de pago

Tres tipos: `card`, `cash`, `transfer`. Hoy solo existe transferencia con comprobante.

**Decisión de diseño — no se guardan datos completos de tarjeta.** El proyecto de clase
(`ecommerce-api/src/models/PaymentMethod.js`) guarda `cardNumber` y `cvv` en texto plano.
El CVV no puede almacenarse bajo PCI-DSS ni siquiera cifrado. WellBox guarda solo marca
y últimos cuatro dígitos, como referencia visual para que la clienta reconozca su
tarjeta. El cobro real sigue siendo fuera de la app.

---

## T-003 — Stock y carrito

`dishes` gana `stock int not null default 0`. El carrito topa la cantidad al stock
disponible y deshabilita el botón cuando llega a cero. La validación se repite en
`app/api/orders/route.ts`: sin eso, dos clientas pueden comprar la última caja al mismo
tiempo. El descuento de stock y la inserción del pedido deben ocurrir en la misma
transacción.

Nota: el proyecto de clase declara `Product.stock` pero **nunca lo valida ni lo
descuenta** — `createOrder` solo crea el pedido. Esta funcionalidad va más allá de la
referencia.

El carrito **no requiere re-modelado**: ya es multi-item (una línea por día, con
cantidad). La restricción de un platillo por día es una regla de negocio, no una
limitación técnica.

---

## T-004 — Manejo de errores y resiliencia

La rúbrica evalúa explícitamente qué pasa cuando el backend falla, con el checkout como
caso central. Pendiente:

- `app/api/orders/route.ts` devuelve 500 genéricos; distinguir 503 (base no disponible)
  de 400 (datos inválidos), sin filtrar detalles internos al cliente
- no existe ErrorBoundary en el flujo de pedido; el checkout necesita uno que deje claro
  si el pago se procesó o no
- estados de carga y error visibles en las pantallas que consumen datos

---

## T-005 — Suite de pruebas

Referencia: `integracion2026/docs/test-plans/backend-test-plan.md` (169 pruebas, Vitest +
Supertest + mongodb-memory-server).

Cobertura mínima propuesta para WellBox:

| Módulo | Tipo | Qué cubre |
|---|---|---|
| `lib/cutoff.ts` | unitario | cierre de pedidos a las 11pm del día anterior |
| `lib/format.ts` | unitario | moneda MXN y etiquetas de fecha en español |
| `lib/date.ts` | unitario | aritmética de fechas ISO |
| cálculo de totales | unitario | precio base + costos extra × cantidad |
| RLS y roles | integración | CA-3, CA-4 y CA-5 del spec T-001 |
| `POST /api/orders` | integración | revalidación de precio, cierre y stock |
| stock | integración | dos pedidos concurrentes por la última pieza |

El repo de clase tiene 169 pruebas de backend y **cero de frontend**, aunque el syllabus
del curso pide "test suite covering components and hooks". Cubrir también componentes es
una ventaja frente a la referencia.
