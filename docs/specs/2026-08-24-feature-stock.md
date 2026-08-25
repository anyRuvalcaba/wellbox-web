# Spec: Stock disponible por platillo

## Metadata
- **Tipo:** feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** DRAFT

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

- [ ] **CA-1** — `dishes` tiene `stock`, editable desde el panel. Nulo = sin límite.
- [ ] **CA-2** — La disponibilidad se calcula descontando los pedidos vivos.
- [ ] **CA-3** — Un pedido `cancelled` o `failed` **devuelve** su stock sin intervención.
- [ ] **CA-4** — El menú muestra cuántas quedan cuando el platillo está por agotarse.
- [ ] **CA-5** — Un platillo agotado no se puede agregar al carrito.
- [ ] **CA-6** — La cantidad en el carrito no puede superar lo disponible.
- [ ] **CA-7** — El servidor rechaza un pedido que exceda el stock, aunque el navegador
      lo permita.
- [ ] **CA-8** — **Dos pedidos simultáneos por la última caja: solo uno pasa.**
- [ ] **CA-9** — Crear un pedido es una sola transacción: no quedan pedidos a medias.
- [ ] **CA-10** — El panel muestra disponibilidad por platillo.

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

> Se completa durante la implementación.

## Resultados

> Se completa al cerrar.
