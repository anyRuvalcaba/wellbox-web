# Spec: Stock disponible por platillo

## Metadata
- **Tipo:** feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** DONE

## Historia

Como **negocio**, quiero definir cuántas cajas puedo preparar de cada platillo, para no
vender más de lo que puedo cocinar.

Como **clienta**, quiero ver cuando algo está por agotarse y que no me deje pedir algo
que ya no hay, en vez de enterarme cuando me lo cancelen.

## Contexto

`dishes` no tiene stock. Se puede pedir cualquier cantidad de cualquier platillo.

El proyecto del curso **declara** `Product.stock` pero **nunca lo aplica**: solo lo usa
para filtrar búsquedas, y su `createOrder` no lo valida ni lo descuenta. Así que esto va
más allá de la referencia.

## Decisión de diseño — el stock disponible se calcula, no se descuenta

Dos formas de llevar la cuenta:

1. **Descontar:** `stock` baja al crear el pedido y sube al cancelarlo.
2. **Calcular:** `disponible = stock − suma de lo pedido en pedidos vivos`.

Se elige **calcular**. La razón es concreta y ya la vivimos en este proyecto: ahora los
pedidos pueden quedar `failed` (tarjeta rechazada) o `cancelled` (checkout abandonado), y
con el modelo de descuento cada uno de esos estados necesitaría lógica compensatoria que
devuelva el stock. Un solo camino que se olvide de compensar deja inventario fantasma
que nadie puede comprar y nadie sabe por qué.

Calculándolo, cancelar un pedido devuelve el stock **solo**, sin código que lo recuerde.
Es autocorrectivo: si el estado de un pedido cambia por cualquier vía —el webhook, el
panel, una corrección a mano en SQL— la disponibilidad se ajusta sin intervención.

El costo es una consulta agregada. Con unos pocos platillos por semana, es irrelevante.

**`stock` nulo significa sin límite.** No todos los platillos tienen tope, y obligar a
poner un número en todos convertiría un dato opcional en una fuente de errores.

## Qué pedidos "consumen" stock

Los que siguen vivos: `pending`, `transfer_uploaded`, `confirmed`, `paid`.

**`pending` sí consume**, aunque todavía no esté pagado: si no, dos clientas podrían
llegar al checkout por la última caja al mismo tiempo y las dos pasarían. Es el mismo
criterio de una tienda que aparta el producto mientras pagas.

**`failed` y `cancelled` no consumen.** Ahí es donde el modelo calculado se paga solo.

## Decisión de diseño — la validación final ocurre dentro de una transacción

Hoy `POST /api/orders` valida y luego inserta en varias llamadas separadas. Entre la
comprobación y la inserción caben otras peticiones: dos clientas pueden ver "queda 1" y
las dos crear su pedido.

La comprobación de stock y la inserción del pedido pasan a una función de Postgres, en
una sola transacción y tomando un candado sobre los platillos involucrados. Es la única
forma de que "queda 1" signifique que solo una se lo lleva.

Esto además paga la deuda técnica registrada en T-001: la creación del pedido deja de ser
una secuencia de inserciones sueltas con un rollback parcheado.

## Criterios de Aceptación

- [x] **CA-1** — `dishes` tiene `stock`, editable desde el panel. Nulo = sin límite.
- [x] **CA-2** — La disponibilidad se calcula descontando los pedidos vivos.
- [x] **CA-3** — Un pedido `cancelled` o `failed` **devuelve** su stock sin intervención.
- [x] **CA-4** — El menú muestra cuántas quedan cuando el platillo está por agotarse.
- [x] **CA-5** — Un platillo agotado no se puede agregar al carrito.
- [x] **CA-6** — La cantidad en el carrito no puede superar lo disponible.
- [x] **CA-7** — El servidor rechaza un pedido que exceda el stock, aunque el navegador
      lo permita.
- [x] **CA-8** — **Dos pedidos simultáneos por la última caja: solo uno pasa.**
- [x] **CA-9** — Crear un pedido es una sola transacción: no quedan pedidos a medias.
- [x] **CA-10** — El panel muestra disponibilidad por platillo.

## Consideraciones de Seguridad

| Amenaza | Escenario | Control |
|---|---|---|
| **T**ampering | Manipular la cantidad desde el navegador | El servidor revalida contra la disponibilidad calculada (CA-7) |
| **T**ampering | Dos peticiones simultáneas por la última pieza | Candado sobre las filas de `dishes` dentro de la transacción (CA-8) |
| **E**levation of Privilege | Una clienta edita el stock | `dishes` ya exige rol admin para escribir |
| **D**enial of Service | Agotar el stock creando pedidos que no se pagan | Los abandonados se cancelan al iniciar otro checkout (T-013), y los `failed` no consumen. Mitigado, no eliminado: queda registrado |

## Decisiones Abiertas

- **AD-1 — ¿Cuánto dura un `pending` consumiendo stock?** Un pedido con tarjeta que nunca
  se paga retiene inventario hasta que la clienta vuelva o el día cierre. Con el volumen
  actual no es problema. Si lo fuera, la solución es caducar los `pending` con cobro
  pendiente después de N minutos.

## Pendientes Abiertos y Gaps Detectados

**Bug encontrado por la propia prueba de CA-3.** La primera versión de `dish_availability`
usaba `left join orders o on o.id = oi.order_id and o.payment_status = any(...)`. Con un
LEFT JOIN, poner la condición del estado dentro del `ON` deja la fila de `order_items`
presente aunque el pedido no califique, así que `sum(oi.quantity)` la seguía contando:
cancelar un pedido no devolvía el stock. Compilaba y devolvía un número plausible.
Corregido con `filter (where o.id is not null)`.

**Se eliminó `delete_incomplete_order()`.** Era el parche que T-001 dejó registrado como
deuda técnica: un rollback manual porque crear un pedido eran varias llamadas HTTP
sueltas. Con `crear_pedido()` como una sola transacción, un fallo a mitad de camino
—incluida la falta de stock— hace que Postgres deshaga todo solo. El parche ya no tiene
trabajo que hacer.

**Dos funciones sin `search_path` fijo.** El linter marcó `day_label_es()` (arrastrado
desde 0006) y `estados_que_consumen_stock()` (heredó el mismo descuido al copiar el
patrón). Corregido en 0014. Ninguna consultaba tablas, así que el riesgo práctico era
bajo, pero es la regla que ya se aplica al resto de las funciones del proyecto.

**Verificación de concurrencia contra producción, no solo local.** Con el servidor de
desarrollo apuntando a la base real, se dispararon dos peticiones `POST /api/orders`
simultáneas por la última unidad de un platillo (`Promise.all` de dos `fetch`). Una
respondió `200` con el pedido creado; la otra, `409` con "Solo quedan 0 de Waffles de
Avena y Queso". La base terminó con `reservado = stock`, sin sobreventa. Es la misma
prueba que en local, pero pasando por el endpoint HTTP completo que van a usar las
clientas reales, no solo por la función de Postgres de forma directa.

**Verificación de que el servidor no confía en el navegador.** Se llamó a
`POST /api/orders` directo por `fetch()`, sin pasar por la interfaz, pidiendo una
cantidad que excedía lo disponible. El servidor respondió `409` con el mensaje exacto de
`verificar_stock()`, y el cobro de Stripe ya iniciado se canceló solo — sin pedido que lo
referenciara, no quedó nada cobrable.

## Resultados

- **Fecha de cierre:** 2026-08-25
- **Rama:** `feature/stock`
- **Migraciones:** 0012, 0013, 0014 — aplicadas y verificadas en producción.
- **28 verificaciones automáticas** pasando con `npm run db:verify`, incluida la de
  concurrencia con dos conexiones reales compitiendo.
- Verificado además en el navegador contra producción: el menú muestra "¡Quedan N!" y
  "Agotado", el botón de agregar queda deshabilitado, y el contador de cantidad topa en
  lo disponible.
