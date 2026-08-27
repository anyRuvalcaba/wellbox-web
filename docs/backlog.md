# Backlog — WellBox

Fuente de verdad del trabajo pendiente. Un ítem = un spec = una rama = un PR.

Cada fase se mapea a un entregable de la evaluación técnica del curso
(app en producción, repo, pruebas ejecutables, defensa verbal).

| ID | Fase | Estado | Entregable que cubre |
|---|---|---|---|
| T-001 | Usuarios, roles y RLS | ✅ DONE | Login y registro operativos |
| T-002 | Perfil, punto de entrega y métodos de pago | ✅ DONE | Checkout completo |
| T-003 | Stock y carrito | ✅ DONE | Carrito completo |
| T-004 | Manejo de errores y resiliencia | ✅ DONE | Rúbrica: resiliencia |
| T-005 | Suite de pruebas con Vitest | ✅ DONE | `npm test` en verde |
| T-006 | README: pase completo de actualización | ✅ DONE | Calidad del repositorio |
| T-007 | Deploy a Vercel y repo público | ✅ DONE | URL pública con SSL |
| T-008 | Preparación de la defensa técnica | PENDIENTE | Justificación verbal |
| T-009 | Duplicar semana anterior en el editor de menú | ✅ DONE | — (mejora operativa) |
| T-010 | Identidad visual: logo y tipografía | ✅ DONE | — (detalle visual) |
| T-011 | Pasarela de pago en línea (Stripe) | ✅ DONE | Checkout completo |
| T-012 | Resolver `npm audit` (3 altas, antes 6) | ✅ DONE | Calidad del repositorio |
| T-013 | Pedidos abandonados en el checkout con tarjeta | ✅ DONE | — (higiene de datos) |
| T-014 | Traducir estados de pago de Stripe en /pedido/mis-pedidos | ✅ DONE | — (detalle de presentación) |
| T-015 | Recuperar contraseña | ✅ DONE | Login y registro operativos |
| T-016 | Landing pública en / | ✅ DONE | Primera impresión / presentación |
| T-017 | Carrito visible en el header y ajustes de checkout | ✅ DONE | Carrito / checkout |
| T-018 | Cierre de pedidos: el código decía 11pm, el real es 6pm | ✅ DONE | Rúbrica: resiliencia |

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


---

## T-010 — Identidad visual: logo y tipografía ✅

El logo actual (`public/logo-wellbox.png`) se veía muy pequeño en el encabezado y la
tipografía del texto "wellBOX" no correspondía a la de la marca.

Al revisar el archivo (1500×1500 px) resultó ser el mismo que ya estaba en `public/`:
el wordmark "wellBOX HEALTHY LUNCH" ya viene dibujado dentro de la imagen. El problema
no era el asset sino el código — lo forzaba a un círculo de 32–64 px (`rounded-full`)
que recortaba el wordmark, y al lado se agregaba un `<span>` con "wellBOX" en
`font-display` para compensar, con una tipografía distinta a la del logo.

Arreglado en `app/pedido/layout.tsx`, `app/(auth)/layout.tsx` y
`app/admin/(dashboard)/layout.tsx`: se quitó el recorte circular, se agrandó la
imagen para que el wordmark se lea, y se eliminó el `<span>` duplicado (el de admin
conserva solo un "admin" chico como contexto, ya que el logo no lo incluye).


---

## T-011 — Pasarela de pago en línea

**El modelo de negocio exige cobrar al momento del pedido**, salvo efectivo:

| Forma de pago | Cuándo se cobra | Estado |
|---|---|---|
| Efectivo | al entregar | ✅ funciona |
| Transferencia | al pedir, con comprobante | ✅ funciona |
| Tarjeta | **al pedir, en línea** | ⚠️ sin pasarela |

Esto reclasifica la pasarela: no es una mejora opcional, es lo que hace que exista la
forma de pago "tarjeta". Sin ella, la opción aparece en el checkout pero no cobra.

Mientras tanto, el checkout dice de frente que el pago quedó pendiente y que **no se ha
cobrado nada**. En un checkout, dejar a la clienta con la duda de si le cobraron es el
peor resultado posible — el propio documento de evaluación le dedica una pregunta modelo
completa a ese escenario.

**Stripe en modo de prueba** no requiere cuenta de comercio ni trámites fiscales: llaves
de prueba, tarjetas de prueba oficiales, y el flujo real de principio a fin. El día que
los pendientes fiscales se resuelvan, se cambian las llaves sin tocar código.

Pendiente de decidir con Any: si entra antes de la evaluación o si la tarjeta se presenta
como "registro con pago pendiente" y la pasarela queda documentada como trabajo futuro.
Las dos son defendibles; lo que no es defendible es que el checkout diga que cobró
cuando no cobró.


---

## T-012 — Resolver las vulnerabilidades de `npm audit`

Al 2026-08-24: **6 vulnerabilidades de severidad alta**, todas en dependencias
transitivas de Next 16.2.9.

| Paquete | Problema |
|---|---|
| `postcss` ≤8.5.22 | XSS al serializar CSS; lectura de archivos arbitrarios vía `sourceMappingURL` |
| `sharp` <0.35.0 | CVEs heredados de libvips |

Se resuelven subiendo Next a 16.3.2 — mismo major, así que el riesgo es acotado.

**No se hizo junto con T-011 a propósito:** mezclar una actualización de framework con
una integración de pagos hace imposible saber qué rompió qué si algo falla. Va en su
propia rama, con `npm run build`, `npm run lint` y `npm run db:verify` como red.

El documento de evaluación pide correr `npm audit` y resolver lo crítico antes de la
defensa, así que esto es entregable, no opcional.


---

## T-013 — Pedidos abandonados en el checkout con tarjeta

Cada vez que alguien elige tarjeta y presiona "Continuar al pago" se crea un pedido en
`pending` con su cobro en Stripe. Si abandona ahí —o recarga la página, porque el
formulario de Stripe vive en estado de React y se pierde— queda un pedido sin pagar.

Es consecuencia directa de una decisión deliberada: **el pedido se crea antes de cobrar**
para que nunca exista un cobro sin pedido. El costo es este ruido, que es el lado barato
del intercambio.

Pendiente:

- Que `/admin/pedidos` distinga "esperando pago" (tiene `stripe_payment_intent_id` y está
  en `pending`) de los pedidos que sí requieren acción del equipo.
- Evaluar reusar el cobro pendiente si la misma clienta vuelve con el mismo carrito, en
  vez de crear otro.
- Considerar el flujo de *deferred intent* de Stripe, que permite montar el formulario
  sin crear el cobro por adelantado.

No bloquea nada: los pedidos abandonados son visibles y no cobran dinero.


---

## T-014 — Traducir estados de pago de Stripe en /pedido/mis-pedidos ✅

`ETIQUETA_PAGO` en `app/pedido/mis-pedidos/page.tsx` solo mapeaba `pending`,
`transfer_uploaded` y `confirmed`. Los estados que llegaron con T-003/T-011
(`paid`, `failed`, `cancelled`) se mostraban tal cual, en inglés y sin badge de color.
Encontrado de paso durante la verificación de T-004, fuera de su alcance.

Arreglado: se reemplazó `ETIQUETA_PAGO` por `ESTADO_PAGO`, un mapa de
`{ etiqueta, clase }` que además de traducir los tres estados nuevos les da color
(verde para `paid`, rojo para `failed`/`cancelled`), consistente con el resto del
diseño.

---

## T-015 — Recuperar contraseña ✅

Salió al intentar entrar a mi propia cuenta de admin sin recordar la contraseña: pedir
recuperación desde el dashboard de Supabase mandaba a la página de inicio en vez de a un
formulario para elegir una nueva, porque no existía ninguna página en la app que
recibiera ese enlace.

Se agregaron dos pantallas nuevas (`app/(auth)/recuperar-contrasena` y
`app/(auth)/restablecer-contrasena`) con el flujo estándar de Supabase
(`resetPasswordForEmail` → enlace por correo → sesión de recuperación → `updateUser`), un
link "¿Olvidaste tu contraseña?" en el login, y se movió `revisarPassword` (antes solo en
`registro/page.tsx`) a `lib/password.ts` para no duplicar la validación entre las dos
pantallas.

Pendiente de un paso manual en el dashboard de Supabase: agregar la URL de
`/restablecer-contrasena` (producción y localhost) a Authentication → URL Configuration →
Redirect URLs — sin eso Supabase sigue redirigiendo al Site URL. Detalle completo en
[defensa-tecnica.md](defensa-tecnica.md), punto 14.

---

## T-016 — Landing pública en / ✅

`app/page.tsx` solo hacía `redirect("/pedido")`; no había ninguna pantalla de marca para
quien llega sin cuenta. Any diseñó una en Claude Design y exportó el paquete de handoff
(`Healthy Clean-Dark Kitchen-handoff.zip`) con el HTML/CSS del mockup, el logo en versión
horizontal y fotos de referencia.

Implementado como página real (no una copia del HTML del mockup): header con logo y
accesos a login/registro, hero, y al hacer scroll — menú de la semana, quiénes somos,
cómo funciona, galería "cambia cada semana", puntos de entrega y CTA final. Sigue vivo
en `/`: si hay sesión, redirige a `/pedido` igual que antes; si no, muestra la landing.

Decisiones tomadas junto con Any, no asumidas:
- **Paleta y tipografía**: el mockup traía un sistema de diseño nuevo (Caprasimo +
  Figtree, verde/naranja en un tono distinto) que se descartó en favor de la marca ya
  establecida (The Seasons + Poppins, colores de `globals.css`), para que la landing no
  se sienta como una pieza aparte del resto del sitio. Sí se conservó el acento naranja
  de los botones del mockup, usando el `rust` que ya existía en la paleta — el primer
  intento salió todo verde (olive, como el resto del sitio) y Any pidió recuperar ese
  contraste.
- **Contenido real, no el texto de ejemplo del mockup**: el menú de la semana, los
  puntos de entrega y el WhatsApp se leen en vivo de Supabase (`menus`/`menu_days`/
  `dishes`, `delivery_locations`, `settings`) en vez de quedar quemados en el HTML.
- **El texto fijo (títulos, "quiénes somos", los 4 pasos, pie de página) se dejó tal
  cual lo escribió Any en el mockup** — al primer intento lo parafraseé y eso introdujo
  errores, el más serio: cambié "6pm" por "11pm" en el cierre de pedidos asumiendo que
  el código (`lib/cutoff.ts`) tenía razón. Era al revés — **el código llevaba el error**,
  no el texto. Ver el hallazgo completo en
  [defensa-tecnica.md](defensa-tecnica.md), sección 9, "El cierre real era a las 6pm, y
  el código decía 11pm".
- **Fotos**: los 9 archivos que traía el handoff (`uploads/menu *.jpg`) resultaron ser
  gráficos de menú semanal ya diseñados (precios y WhatsApp quemados en la imagen), no
  fotografía de platillos — y ningún platillo tiene foto subida todavía en la base. Se
  descartó usarlos (mostrarían precios viejos junto al menú real) y en su lugar el hero,
  la tarjeta de cada día y la galería muestran un placeholder "Foto pendiente" hasta que
  Any pase fotos reales. `app/HeroCarousel.tsx` (carrusel con fade automático) queda
  listo para conectarse en cuanto haya fotos.

---

## T-017 — Carrito visible en el header y ajustes de checkout ✅

Any probó el flujo de pedido a fondo (agregando el menú de la semana en el admin) y
encontró varios huecos reales:

- **No había forma rápida de "agregar" un platillo.** Toda la fila era el único punto
  de toque, sin un botón visible — solo aparecía "Quitar" una vez agregado. Se agregó un
  chip "Agregar" explícito en [MenuBrowser.tsx](../app/pedido/MenuBrowser.tsx), a la par
  de "Quitar".
- **El carrito no se veía fuera de `/pedido`.** `CartBar` (la barra inferior con el
  total) es propia de esa pantalla; en `/pedido/perfil` o `/pedido/mis-pedidos`
  desaparecía. Se agregó [CartIcon.tsx](../app/pedido/CartIcon.tsx) — un ícono de bolsa
  con contador — al header de `/pedido`, y también al de la landing (ver T-016): con
  sesión iniciada y platillos ya en el carrito, el icono los muestra desde ahí y lleva a
  `/pedido/resumen`.
- **La landing ya no manda directo a `/pedido` con sesión iniciada.** Antes
  `redirect("/pedido")` bloqueaba por completo ver `/` estando logueada. Ahora se queda
  en la landing y el header cambia: en vez de "Crear cuenta"/"Iniciar sesión" muestra el
  carrito y el mismo menú de cuenta de `/pedido` (perfil, mis pedidos, cerrar sesión).
  Esto obligó a que `CartProvider` (antes solo en `app/pedido/layout.tsx`) también
  envuelva `app/page.tsx` — son dos instancias independientes que leen el mismo
  `sessionStorage`, no una compartida, porque son árboles de layout distintos.
- **El logo del header de `/pedido` ahora regresa siempre a `/`.** Antes iba a
  `/pedido` — tenía sentido cuando la landing bloqueaba a quien tenía sesión, pero ya no
  aplica: Any confirmó que el logo debe ser "volver al inicio" siempre, no "volver al
  menú".
- **El formulario de "+ Otra forma de pago" no se cerraba solo.** En
  [PagoForm.tsx](../app/pedido/pago/PagoForm.tsx), si lo abrías y luego elegías
  "Tarjeta" en la lista de arriba sin darle Cancelar, se quedaba abierto estorbando.
  Ahora elegir cualquier método existente lo cierra.
- **Las opciones "¿Sí o no?" (sobre de stevia, cubiertos) no eran un bug.** Están
  armadas como grupo `multiple`, no requerido, con una sola opción "Sí" — es un
  checkbox: sin marcar significa que no, no hace falta un botón "No" aparte. Se explicó
  el patrón, no se cambió código.

---

## T-018 — Cierre de pedidos: el código decía 11pm, el real es 6pm ✅

`lib/cutoff.ts` cerraba pedidos a las 11pm desde T-005, con pruebas verdes. El horario
real del negocio es 6pm — 5 horas menos. Nadie lo notó porque nunca había un texto en
la app que dijera la hora en palabras, solo un contador. Salió al construir T-016 y
comparar contra el mockup, que sí decía "6pm".

Arreglado en el código, no solo en el texto: `lib/cutoff.ts`, sus pruebas
(`lib/__tests__/cutoff.test.ts`), el comentario y el mensaje de "ya cerró" en
[MenuBrowser.tsx](../app/pedido/MenuBrowser.tsx), y las menciones sueltas en
`defensa-tecnica.md` y la migración `0011_cancelar_pedidos_abandonados.sql`. Detalle
completo y la lección en [defensa-tecnica.md](defensa-tecnica.md), sección 9.

---

## T-006 — README: pase completo de actualización

El README arrastra afirmaciones que ya no son ciertas, de fases anteriores a que se
escribieran:

- "No hay registro público — los usuarios se crean a mano en el dashboard de Supabase"
  (falso desde T-001)
- "Pagos: solo transferencia bancaria + comprobante (sin pasarela de pago)" (falso desde
  T-011)
- "Estructura del proyecto" no menciona `app/(auth)/`, stock, puntos de entrega, Stripe,
  ni las pruebas

Encontrado de paso al documentar T-005. Necesita una revisión completa, no parches
puntuales — se deja para su propia pasada en vez de tocarlo a medias aquí.
