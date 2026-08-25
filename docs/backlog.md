# Backlog — WellBox

Fuente de verdad del trabajo pendiente. Un ítem = un spec = una rama = un PR.

Cada fase se mapea a un entregable de la evaluación técnica del curso
(app en producción, repo, pruebas ejecutables, defensa verbal).

| ID | Fase | Estado | Entregable que cubre |
|---|---|---|---|
| T-001 | Usuarios, roles y RLS | ✅ DONE | Login y registro operativos |
| T-002 | Perfil, punto de entrega y métodos de pago | EN CURSO | Checkout completo |
| T-003 | Stock y carrito | PENDIENTE | Carrito completo |
| T-004 | Manejo de errores y resiliencia | PENDIENTE | Rúbrica: resiliencia |
| T-005 | Suite de pruebas con Vitest | PENDIENTE | `npm test` en verde |
| T-006 | README y `npm audit` | PENDIENTE | Calidad del repositorio |
| T-007 | Deploy a Vercel y repo público | PENDIENTE | URL pública con SSL |
| T-008 | Preparación de la defensa técnica | PENDIENTE | Justificación verbal |
| T-009 | Duplicar semana anterior en el editor de menú | PENDIENTE | — (mejora operativa) |

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

**AD-3 (RESUELTO 2026-08-24) — El punto de entrega es inmutable para la clienta.**

Se aplica así: la clienta lo elige **una sola vez**, al registrarse. A partir de ese
momento solo un `admin` puede cambiarlo desde el panel.

Técnicamente es el mismo patrón que protege `profiles.role`: un trigger `BEFORE UPDATE`
revierte el cambio salvo que `public.is_admin()` sea verdadero. La única excepción es el
primer valor — si `delivery_location_id` está en `NULL`, la clienta puede fijarlo. Sin
esa excepción, el registro self-service no podría completarse.

El snapshot `orders.delivery_location_name` se mantiene de todas formas: aunque el punto
sea inmutable para la clienta, un admin sí lo puede cambiar, y los pedidos anteriores
deben seguir mostrando dónde se entregaron.

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


---

## T-007 — Riesgo: la base de datos se pausa sola

Los proyectos de Supabase en plan gratuito pasan a `INACTIVE` tras varios días sin
actividad. Al 2026-08-24 los tres proyectos de la cuenta están pausados, incluido
`wellbox` (`zkfeuibnjfbqiwpuaifh`).

Es el mismo riesgo del que advierte el documento de evaluación sobre Render, pero peor:
Render despierta solo con una visita en ~30 segundos; **Supabase pausado no despierta
solo** — hay que restaurarlo a mano desde el dashboard y tarda varios minutos.

Mitigación: restaurar el proyecto varios días antes de la evaluación y tocarlo a diario
hasta entonces. Verificar la URL de producción el mismo día, no solo 30 minutos antes.

---

## T-008 — Preparación de la defensa técnica

Sesión aparte, al final del proyecto. No es documentación entregable: es práctica de
explicar en voz alta y sin leer.

- Recorrer el flujo de datos de extremo a extremo (dimensión "comprensión de la
  arquitectura" de la rúbrica)
- Justificar cada decisión contra su alternativa: Next.js vs. React + Express,
  Postgres vs. MongoDB, Supabase Auth vs. JWT propio, TypeScript vs. JavaScript,
  puntos de entrega fijos vs. direcciones libres
- Preparar el recorrido de las pruebas: qué cubre cada una y por qué esa y no otra
- Practicar cronometrado, 10 minutos máximo
- Tener lista una respuesta honesta a "si lo rehicieras, ¿qué cambiarías?"

Insumo listo: `docs/specs/` guarda el porqué de cada decisión en el momento en que se
tomó, que es más confiable que reconstruirlo de memoria seis semanas después.


---

## T-009 — Duplicar semana anterior en el editor de menú

El menú nuevo sale cada semana entre miércoles y jueves y se captura a mano en
`/admin/menu`. No existe importación desde Excel ni ninguna fuente externa, y **no
conviene agregarla**: armar el menú es una decisión del negocio, no un dato que ya viva
en otro sistema. Una importación solo se justifica cuando el dato existe en otro lado;
aquí sería teclear lo mismo en Excel y sumar una fuente de errores.

Lo que sí se repite semana a semana son los nombres de platillos, sus precios y sobre
todo los grupos de opciones. Un botón **"duplicar semana anterior"** que copie la
estructura completa con fechas recorridas quita la mayor parte del tecleo con una
fracción de la complejidad de una importación.

Prioridad: después de las fases evaluadas. Es comodidad operativa, no un entregable.
