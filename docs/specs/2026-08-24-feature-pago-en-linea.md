# Spec: Pago en línea con tarjeta

## Metadata
- **Tipo:** feature
- **Complejidad:** L
- **Fecha:** 2026-08-24
- **Estado:** DRAFT

## Historia

Como **clienta de WellBox**, quiero pagar con tarjeta en el momento de hacer mi pedido,
para no tener que hacer una transferencia ni llevar efectivo.

Como **negocio**, quiero cobrar al confirmar el pedido y no al entregarlo, para no
depender de que la clienta pague después.

## Contexto

WellBox cobra al confirmar el pedido salvo en efectivo. Hoy transferencia funciona (con
comprobante) y efectivo funciona (se cobra al entregar), pero **tarjeta no cobra nada**:
el checkout registra la intención y avisa que el pago quedó pendiente.

**El proyecto del curso tampoco cobra.** Se verificó: no hay ninguna pasarela en las
dependencias de `ecommerce-api` ni de `ecommerce-app`, y su `Checkout.jsx` hace
`apiClient.post("/orders", ...)` y navega a la confirmación. El `PaymentMethod` que
guardan con número de tarjeta y CVV nunca se usa para cobrar. Así que esta funcionalidad
va más allá de la referencia, no la replica.

## Decisión de diseño principal — Stripe es el dueño de las tarjetas

El Payment Element de Stripe, combinado con una `CustomerSession`, **ya muestra las
tarjetas guardadas de la clienta, le permite elegir entre ellas, agregar una nueva,
borrarlas, y decidir si guardar la que está usando.** Eso es exactamente lo que se pidió,
y viene resuelto.

Por lo tanto:

- `payment_methods` deja de guardar tarjetas. Conserva solo `cash` y `transfer`, que son
  formas de pago que WellBox opera por su cuenta.
- Las tarjetas viven en Stripe, ligadas a un `Customer` por clienta.
- No se duplica el dato. Mantener marca y últimos 4 en dos lugares es garantizar que
  algún día no coincidan.

**Esto refuerza la decisión de no almacenar datos de tarjeta**: con el Payment Element,
el número nunca toca el servidor de WellBox — se captura dentro de un iframe de Stripe.
Antes la decisión era "no lo guardamos"; ahora es "no lo recibimos".

## Decisión de diseño — el pedido se crea antes del cobro

Se crea el pedido en estado `pending`, después se cobra, y al confirmarse el cobro se
marca `paid`.

La alternativa —cobrar primero y crear el pedido después— tiene una falla peor: si el
cobro pasa y la creación del pedido falla, la clienta quedó cobrada sin pedido, y no hay
registro de qué compró. Con este orden, el peor caso es un pedido `pending` que sí se
pagó: visible, reconciliable y sin dinero perdido de vista.

El documento de evaluación dedica una pregunta modelo completa a este escenario.

## Dinero en centavos

Stripe recibe importes en la unidad mínima de la moneda: MXN 155.00 son `15500`. El
importe se calcula **en el servidor** a partir del carrito, nunca se recibe del cliente —
mismo criterio que ya usa `POST /api/orders`.

## Criterios de Aceptación

- [ ] **CA-1** — Existe `profiles.stripe_customer_id`, creado la primera vez que la
      clienta paga con tarjeta.
- [ ] **CA-2** — El importe del cobro se calcula en el servidor desde el carrito; un
      importe manipulado en el cliente no cambia lo que se cobra.
- [ ] **CA-3** — El Payment Element muestra las tarjetas guardadas de esa clienta y
      permite agregar una nueva.
- [ ] **CA-4** — Una clienta **no** puede ver ni usar las tarjetas de otra.
- [ ] **CA-5** — Un pago exitoso deja el pedido en `paid`.
- [ ] **CA-6** — Una tarjeta rechazada **no** crea un pedido cobrable ni lo marca `paid`;
      el pedido queda `pending` con el motivo visible.
- [ ] **CA-7** — Una tarjeta que exige autenticación (3D Secure) completa el flujo.
- [ ] **CA-8** — `payment_methods` ya no admite filas de tipo `card`.
- [ ] **CA-9** — Efectivo y transferencia siguen funcionando igual.
- [ ] **CA-10** — Las llaves secretas nunca llegan al navegador.

## Consideraciones de Seguridad

| Amenaza | Escenario | Control |
|---|---|---|
| **T**ampering | Manipular el importe desde el cliente | El importe se calcula en el servidor desde el carrito (CA-2) |
| **I**nformation Disclosure | Una clienta ve las tarjetas de otra | La `CustomerSession` se emite para el `stripe_customer_id` de la sesión autenticada (CA-4) |
| **I**nformation Disclosure | Fuga de la base expone datos de tarjeta | El número nunca llega al servidor: se captura en el iframe de Stripe |
| **S**poofing | Marcar como pagado un pedido que no se pagó | El estado se decide consultando el PaymentIntent a Stripe desde el servidor, nunca por lo que diga el cliente |
| **R**epudiation | No queda rastro de un cobro | `orders` guarda el id del PaymentIntent |

**Secretos:** `STRIPE_SECRET_KEY` solo en el servidor. La publicable
(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) es pública por diseño. Ninguna se commitea:
`.env.example` lleva solo los nombres.

## Diseño propuesto

```sql
alter table profiles add column stripe_customer_id text;
alter table orders   add column stripe_payment_intent_id text;
alter table orders   add column payment_error text;

-- payment_methods deja de aceptar tarjetas: ahora las administra Stripe.
-- Las filas 'card' que existan se eliminan porque no son cobrables.
```

Flujo:

1. La clienta elige "tarjeta" en el checkout.
2. El servidor calcula el total, crea el pedido `pending`, y crea el PaymentIntent (con
   el `Customer` de la clienta, creándolo si no existe) más una `CustomerSession` con el
   componente `payment_element` y las funcionalidades de guardar, mostrar y borrar
   métodos.
3. El cliente monta el Payment Element con los dos *client secrets* y confirma.
4. El servidor consulta el PaymentIntent a Stripe. Si está `succeeded`, marca el pedido
   `paid`; si no, lo deja `pending` con el motivo.

## Decisiones Abiertas

- **AD-1 — ¿Webhook de Stripe?** Si la clienta cierra la pestaña justo después de pagar,
  el paso 4 no ocurre y el pedido queda `pending` aunque el cobro pasó. Un webhook
  `payment_intent.succeeded` lo cierra sin depender del navegador. Requiere exponer una
  ruta pública y configurar el endpoint en Stripe (en local, con la CLI de Stripe).
  **Recomendación: implementarlo.** Es la diferencia entre "funciona" y "funciona cuando
  algo sale mal", que es justo lo que la rúbrica evalúa. Si se pospone, queda registrado
  como deuda con su consecuencia concreta.

## Dependencias

- Externas: `stripe` (servidor), `@stripe/stripe-js` y `@stripe/react-stripe-js`
  (cliente). Cuenta de Stripe en **modo de prueba** — no requiere cuenta de comercio ni
  trámites fiscales.
- Internas: `app/api/orders/route.ts`, `app/pedido/pago/*`, `payment_methods`, `profiles`.

## Riesgos y Deuda Técnica

- Las dos tarjetas de prueba que existen hoy en `payment_methods` no son cobrables: se
  crearon capturando marca y últimos 4 a mano. Se eliminan en la migración.
- Sin webhook (ver AD-1), un pedido pagado puede quedar `pending` si el navegador se
  cierra en el momento exacto.
- Modo de prueba ≠ producción: hay diferencias de comportamiento en 3D Secure reales.
  Queda dicho de frente en la defensa.

## Pendientes Abiertos y Gaps Detectados

> Se completa durante la implementación.

## Resultados

> Se completa al cerrar.
