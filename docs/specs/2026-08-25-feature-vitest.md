# Spec: Suite de pruebas con Vitest

## Metadata
- **Tipo:** feature
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DONE

## Historia

Como **evaluadora del proyecto**, quiero correr `npm test` desde la raíz del repositorio
y ver todas las pruebas pasar sin tocar código, para verificar que el proyecto tiene
cobertura real y no solo lo que se ve a simple vista.

## Contexto

El documento de evaluación lo pide de forma literal:

```
# Desde la raíz del repositorio
npm test
# Todas las pruebas deben pasar sin modificar código
```

Hoy no existe ni `vitest` instalado ni un script `test` en `package.json`. Lo que sí
existe — y es real, no un sustituto de cortesía — es `npm run db:verify`: 28
verificaciones en SQL contra Postgres, incluida una prueba de concurrencia con dos
conexiones reales compitiendo por la última unidad de un platillo. Pero corre contra un
Postgres local que hay que tener instalado y arrancado; no es lo que un evaluador espera
al teclear `npm test`.

## Decisión de diseño — dos comandos, no uno forzado

`npm test` se queda como pruebas de Vitest: rápidas, sin dependencias externas, listas
para correr en cualquier máquina con `npm install`. `npm run db:verify` sigue siendo la
suite de seguridad y concurrencia contra Postgres real — no tiene sentido reescribir en
JavaScript lo que ya está probado y funcionando en SQL, y la prueba de concurrencia
específicamente necesita dos conexiones reales a una base real; no se puede replicar de
forma honesta con mocks.

Es la misma separación que ya usa el proyecto del curso: unitarios sin tocar nada externo
(`test:unit`) vs. integración contra una base real (`test:integration`, con
`mongodb-memory-server`). La diferencia es que Postgres no tiene un equivalente maduro a
`mongodb-memory-server` para levantar una instancia embebida en el proceso de pruebas, así
que WellBox usa un Postgres local real vía Homebrew en vez de una base en memoria — misma
idea, mecanismo distinto porque el motor es distinto.

## Decisión de diseño — qué se prueba con Vitest

No se trata de imitar los 28 checks de SQL en JavaScript. Se prueba lo que **no** está
cubierto ahí: funciones puras de `lib/` que nunca se tocaron con una prueba automatizada,
y un par de componentes de React — el proyecto del curso tiene 169 pruebas de backend y
**cero de frontend**, aunque su propio syllabus pide "test suite covering components and
hooks". Cubrir componentes es ventaja frente a la referencia, no relleno.

| Módulo | Qué prueba | Por qué importa |
|---|---|---|
| `lib/cutoff.ts` | cierre a las 11pm del día anterior, sin horario de verano | Si esto falla, se aceptan o rechazan pedidos en el momento equivocado |
| `lib/format.ts` | pesos mexicanos, fechas y rangos en español | Un bug aquí se ve en cada pantalla, todo el tiempo |
| `lib/date.ts` | aritmética de fechas ISO | La usa la duplicación de semanas (T-009); un desfase de un día correría mal toda la semana copiada |
| `lib/pagos.ts` | qué texto ve la clienta según el método de pago | Encadena varios `if`; un caso mal cubierto se nota en el checkout |
| `lib/dinero.ts` (nuevo) | redondeo a centavos para Stripe | Dinero. `Math.round` vs. truncar es la diferencia entre cobrar bien y cobrar de menos |
| `QuantityStepper` | el botón "+" se desactiva en el tope de stock | Es la pieza de interfaz que construyó T-003 para evitar sobreventa desde el navegador |

## Decisión de diseño — extraer `aCentavos` de `lib/stripe/server.ts`

`lib/stripe/server.ts` lanza una excepción al importarse si no existe
`STRIPE_SECRET_KEY` — correcto en producción (falla rápido y claro), pero significa que
cualquier prueba que importe ese archivo revienta al cargarlo, sin haber probado nada
todavía. `aCentavos()` y `MONEDA` no dependen de Stripe en absoluto: se mueven a
`lib/dinero.ts`, puro, sin importar el SDK. `lib/stripe/server.ts` los re-exporta, así
que nada que ya lo importe cambia.

## Criterios de Aceptación

- [x] **CA-1** — `npm test` corre sin quedarse en modo watch y termina con código 0.
- [x] **CA-2** — Cada módulo de la tabla de arriba tiene pruebas, incluidos casos borde
      (medianoche exacta del cierre, cero centavos, fecha que cruza fin de mes).
- [x] **CA-3** — `aCentavos()` se prueba sin necesitar `STRIPE_SECRET_KEY`.
- [x] **CA-4** — El README explica la diferencia entre `npm test` y `npm run db:verify`,
      y cuándo corre cada uno.
- [x] **CA-5** — Verificado en limpio: `rm -rf node_modules && npm install && npm test`
      pasa sin ajustes, no solo en la máquina donde se escribió.

## Riesgos y Deuda Técnica

- No hay pruebas de los Server Components async (páginas de `/pedido` y `/admin`): Vitest
  no los soporta directamente — es la propia documentación de Next 16 la que lo dice y
  recomienda E2E para esos casos. Cubierto en su lugar por la verificación manual en
  navegador contra producción que ya se hizo en T-001 a T-004.

## Pendientes Abiertos y Gaps Detectados

**Vitest no limpia el DOM entre pruebas solo, a diferencia de Jest.** El primer intento
de `QuantityStepper.test.tsx` falló 5 de 6 pruebas con "multiple elements found": los
renders de una prueba se quedaban montados para la siguiente. Se corrigió con
`afterEach(cleanup)` en `vitest.setup.mts`. Un recordatorio de que "usa Vitest en vez de
Jest" no es un cambio cosmético — el comportamiento por defecto difiere.

**`aCentavos()` estaba acoplado a un archivo que revienta sin `STRIPE_SECRET_KEY`.**
Se extrajo a `lib/dinero.ts`, puro, sin importar el SDK de Stripe.
`lib/stripe/server.ts` lo re-exporta — ningún importador existente cambió.

**Advertencias de configuración de Vite, resueltas antes de dar el spec por cerrado.**
`vitest.config.ts` avisaba que se cargaba como CommonJS por sintaxis ESM sin
`"type": "module"` en `package.json` (no se tocó ese campo — afectaría al resto de la
app Next). Se renombró a `.mts`. Y `vite-tsconfig-paths` ya no hacía falta: Vite lo
resuelve nativamente vía `resolve.tsconfigPaths` — una dependencia de menos.

**`npm install` limpio avisó que `@supabase/auth-js` pide Node ≥22** (esta máquina corre
20.20.1). Es una advertencia, no un error — la app y las pruebas funcionan igual — pero
queda registrado como riesgo de reproducibilidad en otra máquina.

**Encontrado de paso, fuera de alcance:** el README tiene afirmaciones desactualizadas
de antes de T-001 y T-011 (registro público, pasarela de pago). Ampliado el alcance de
T-006 en el backlog para cubrirlo con su propia pasada.

## Resultados

- **Fecha de cierre:** 2026-08-25
- **Rama:** `feature/vitest`
- **43 pruebas, 7 archivos, todas pasando**, en ~2 segundos
- Verificado en limpio: `rm -rf node_modules package-lock.json && npm install && npm test`
  pasa sin ajustes (CA-5)
- `npm run build`, `npm run lint` y `npx tsc --noEmit` siguen limpios tras los cambios
- `npm audit` bajó de 6 a 3 vulnerabilidades altas como efecto colateral de las
  dependencias nuevas — T-012 actualizado
