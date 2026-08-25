# Spec: Manejo de errores y resiliencia

## Metadata
- **Tipo:** feature
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DRAFT

## Historia

Como **clienta**, cuando WellBox no puede conectarse a la base de datos quiero que me lo
diga claramente, no que me haga pensar que no hay menú o que no tengo pedidos.

Como **negocio**, si la base cae en pleno checkout, quiero que a la clienta le quede claro
si se le cobró o no — nunca la duda.

## Contexto

El documento de evaluación dedica una pregunta modelo completa a "¿qué pasa si la base de
datos se cae mientras un usuario está en el checkout?", y la rúbrica tiene una dimensión
propia sobre resiliencia.

**Hallazgo verificado antes de diseñar esto** (no supuesto): `supabase-js` **no lanza
excepciones** cuando la conexión falla. Se probó contra un puerto sin nada escuchando:

```
error: { message: "TypeError: fetch failed", code: "" }
```

Devuelve `{ data: null, error: {...} }`, igual que cuando una consulta es válida pero no
encuentra filas. Esto cambia el diagnóstico: el problema no es la ausencia de
`try/catch` — es que **11 páginas del servidor leen `data` y nunca miran `error`**:

```
app/pedido/page.tsx                          app/admin/(dashboard)/page.tsx
app/pedido/pago/page.tsx                      app/admin/(dashboard)/pedidos/page.tsx
app/pedido/perfil/page.tsx                    app/admin/(dashboard)/usuarios/page.tsx
app/pedido/mis-pedidos/page.tsx               app/admin/(dashboard)/menu/page.tsx
app/pedido/confirmacion/page.tsx              app/admin/(dashboard)/menu/[menuId]/page.tsx
                                               app/admin/(dashboard)/entregas/page.tsx
```

Con la base caída, `/pedido` hoy diría "Por ahora no hay menú disponible, vuelve a checar
pronto" — una respuesta que suena a decisión de negocio, no a una falla técnica. Y
`/pedido/mis-pedidos` diría "Todavía no has hecho ningún pedido" a una clienta que sí
tiene pedidos: la base no le devolvió nada, y el código no distinguió por qué.

## Decisión de diseño — distinguir "vacío" de "falló"

En cada una de esas páginas, `data: null` puede significar dos cosas completamente
distintas, y hoy se tratan igual:

1. La consulta funcionó y no hay filas (vacío de verdad).
2. La consulta no pudo ejecutarse (la base no respondió).

Se agrega `esFalloDeConexion(error)` en `lib/db-error.ts`: una heurística que detecta el
patrón de `TypeError: fetch failed` que ya se confirmó. No es infalible —no existe un
código de error estándar de Postgres para "no pude ni preguntar"— pero es el mismo patrón
verificado arriba, documentado como heurística y no como certeza.

Cada página pasa a desestructurar también `error`, y cuando `esFalloDeConexion(error)` es
verdadero, muestra un mensaje distinto: **"Estamos teniendo problemas para conectarnos.
Intenta de nuevo en un momento."**, nunca el vacío legítimo.

## Decisión de diseño — el checkout con tarjeta ya tenía la parte difícil resuelta

`POST /api/orders` ya revisa `error` en cada consulta (`dishesError`, `choicesError`,
`orderError`) y ya distingue 400 de 503 para el cobro con Stripe. Lo que falta es
consistencia: subir esas comprobaciones genéricas de 500 a 503 cuando el error tiene la
forma de un fallo de conexión, con un mensaje que diga de frente que no se cobró nada —
mismo criterio que ya se aplicó en T-011 para la tarjeta rechazada.

## Decisión de diseño — `error.tsx` como red de seguridad, no como la solución

No existe un solo `error.tsx` en el proyecto. Es una red distinta a la del punto
anterior: cubre errores de **programación** de verdad (una excepción no capturada, un
`undefined.algo`), no la caída de Supabase, que ya se maneja como valor de retorno según
la propia guía de Next 16 ("expected errors → return values; uncaught exceptions →
error boundaries").

Se agregan tres, con el tono que le corresponde a cada audiencia:

- `app/pedido/error.tsx` — tono cálido, sin jerga, botón de reintentar.
- `app/admin/error.tsx` — puede mostrar más detalle técnico, es el equipo.
- `app/global-error.tsx` — red final si algo truena en el layout raíz.

Next 16 cambia el contrato de este archivo respecto a versiones anteriores: el prop ya
no es solo `reset` (que limpia el estado sin volver a pedir datos), ahora es
`unstable_retry` (vuelve a pedir los datos y renderiza de nuevo) — es el que corresponde
usar aquí, porque la causa más probable de un error en estas páginas es justo una
conexión que ya se recuperó.

## Criterios de Aceptación

- [ ] **CA-1** — `esFalloDeConexion()` existe y distingue el patrón verificado.
- [ ] **CA-2** — Las 5 páginas del flujo de cliente muestran un mensaje de conexión
      distinto del vacío legítimo.
- [ ] **CA-3** — Las 6 páginas del admin hacen lo mismo.
- [ ] **CA-4** — `POST /api/orders`: cualquier fallo de conexión durante la creación del
      pedido responde 503 con mensaje que aclara que no se cobró nada.
- [ ] **CA-5** — Existen `error.tsx` para `/pedido`, `/admin` y uno global.
- [ ] **CA-6** — Verificado con una caída real simulada (Supabase apuntando a un host
      inalcanzable), no solo revisado en el código.

## Consideraciones de Seguridad

| Amenaza | Escenario | Control |
|---|---|---|
| **I**nformation Disclosure | El mensaje de error expone detalles internos (URLs, stack traces) | Los mensajes al cliente son genéricos; el `error.message` completo solo se loguea en servidor |
| **D**enial of Service | Reintentos automáticos agresivos contra una base ya caída | No se agrega reintento automático, solo manual (botón); evita amplificar una caída real |

## Decisiones Abiertas

- **AD-1 — ¿`loading.tsx`?** Fuera de alcance: es UX de carga, no manejo de errores. Si
  se quiere pulir la percepción de velocidad, es una tarea aparte.

## Pendientes Abiertos y Gaps Detectados

> Se completa durante la implementación.

## Resultados

> Se completa al cerrar.
