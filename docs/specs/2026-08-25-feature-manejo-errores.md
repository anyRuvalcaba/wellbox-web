# Spec: Manejo de errores y resiliencia

## Metadata
- **Tipo:** feature
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DONE

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

- [x] **CA-1** — `esFalloDeConexion()` existe y distingue el patrón verificado.
- [x] **CA-2** — Las 5 páginas del flujo de cliente muestran un mensaje de conexión
      distinto del vacío legítimo.
- [x] **CA-3** — Las 6 páginas del admin hacen lo mismo.
- [x] **CA-4** — `POST /api/orders`: cualquier fallo de conexión durante la creación del
      pedido responde 503 con mensaje que aclara que no se cobró nada.
- [x] **CA-5** — Existen `error.tsx` para `/pedido`, `/admin` y uno global.
- [x] **CA-6** — Verificado con una caída real simulada (Supabase apuntando a un host
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

**Hallazgo mayor, fuera del alcance original del spec.** Verificando CA-2 contra una
caída real (`/pedido` con Supabase apuntando a un host inalcanzable), apareció algo más
grave que las 11 páginas: **`proxy.ts` y `lib/auth.ts` expulsaban a cualquiera al
login** cuando `getUser()` fallaba por conexión — sin distinguir "no hay sesión" de "no
se pudo verificar". Le pasaba a admins y a clientas en pleno checkout, que es
exactamente el escenario que la rúbrica pregunta.

Corrección en las dos capas: `getSession()` lee la cookie sin red (confirmado leyendo el
código fuente de `@supabase/auth-js`, no supuesto); si encuentra una sesión pero
`getUser()` no pudo verificarla, ya no se concluye "no hay sesión":
- **`proxy.ts`** (primera capa): deja pasar la petición en vez de bloquear.
- **`lib/auth.ts`** (segunda capa): lanza una excepción — la atrapan los `error.tsx` que
  ya se habían agregado, con su botón de reintentar, en vez de un redirect silencioso.

**Verificación de esta corrección específica.** No se pudo probar contra la app corriendo
completa con una caída real: cambiar `NEXT_PUBLIC_SUPABASE_URL` a un host inalcanzable
también cambia el nombre de cookie que `@supabase/ssr` espera (se deriva de la
referencia del proyecto), así que el cliente deja de encontrar la cookie real por una
razón ajena a la que se quería probar — y no se puede usar `/etc/hosts` para simular la
caída manteniendo la URL real, por estar fuera de lo que se debe modificar sin
autorización explícita de la usuaria.

En su lugar se armó una prueba aislada, sin tocar la app en ejecución: un script que usa
la URL real del proyecto (para que el nombre de cookie coincida) y una cookie de sesión
real capturada de una petición autenticada, con `fetch` interceptado para fallar solo
quirúrgicamente. Resultado:

```
── con red ──
getUser() con red → user: prueba.clienta@wellbox-test.mx
── sin red ──
getSession() sin red → session: ENCONTRADA (local, sin red)
getUser() sin red    → user: null (como se esperaba, necesita red)
```

Confirma exactamente la premisa del arreglo. El token usado nunca se escribió a un
archivo: viajó por variable de entorno y el script se borró al terminar.

**Regresión verificada por separado:** una petición sin ninguna cookie sigue
redirigiendo a `/login` (`curl` directo contra el servidor, sin credenciales) — el
arreglo no abre una puerta a quien de verdad no tiene sesión.

**Detalle encontrado de paso, fuera de alcance:** `/pedido/mis-pedidos` muestra los
estados de pago que llegaron con Stripe (`paid`, `failed`, `cancelled`) sin traducir.
Registrado como T-014.

## Resultados

- **Fecha de cierre:** 2026-08-25
- **Rama:** `feature/manejo-errores`
- 11 páginas del servidor ahora distinguen "vacío" de "falló la conexión"
- `POST /api/orders`: tres puntos de fallo pasan de 500 genérico a 503 con mensaje de
  "no se te cobró nada" cuando el patrón es de conexión
- Tres `error.tsx` (`/pedido`, `/admin`, global) usando `unstable_retry` — el contrato
  correcto en Next 16, distinto de versiones anteriores
- **El hallazgo más importante de la fase no estaba en el spec original**: el proxy y el
  DAL expulsaban al login a cualquiera durante una caída, en vez de mostrar un error.
  Corregido en las dos capas y verificado con una prueba aislada que reproduce la
  premisa exacta (`getSession()` local, `getUser()` necesita red) contra el proyecto
  real, sin tocar configuración del sistema.
