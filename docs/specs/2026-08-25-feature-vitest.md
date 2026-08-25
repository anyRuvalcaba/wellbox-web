# Spec: Suite de pruebas con Vitest

## Metadata
- **Tipo:** feature
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DRAFT

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

- [ ] **CA-1** — `npm test` corre sin quedarse en modo watch y termina con código 0.
- [ ] **CA-2** — Cada módulo de la tabla de arriba tiene pruebas, incluidos casos borde
      (medianoche exacta del cierre, cero centavos, fecha que cruza fin de mes).
- [ ] **CA-3** — `aCentavos()` se prueba sin necesitar `STRIPE_SECRET_KEY`.
- [ ] **CA-4** — El README explica la diferencia entre `npm test` y `npm run db:verify`,
      y cuándo corre cada uno.
- [ ] **CA-5** — Verificado en limpio: `rm -rf node_modules && npm install && npm test`
      pasa sin ajustes, no solo en la máquina donde se escribió.

## Riesgos y Deuda Técnica

- No hay pruebas de los Server Components async (páginas de `/pedido` y `/admin`): Vitest
  no los soporta directamente — es la propia documentación de Next 16 la que lo dice y
  recomienda E2E para esos casos. Cubierto en su lugar por la verificación manual en
  navegador contra producción que ya se hizo en T-001 a T-004.

## Pendientes Abiertos y Gaps Detectados

> Se completa durante la implementación.

## Resultados

> Se completa al cerrar.
