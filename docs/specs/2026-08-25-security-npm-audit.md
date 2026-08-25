# Spec: Resolver `npm audit` — actualización de Next.js

## Metadata
- **Tipo:** security-patch
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DONE

## Historia

Como **negocio**, quiero que el repositorio no tenga vulnerabilidades conocidas de
severidad alta antes de la defensa técnica, porque el documento de evaluación pide
correr `npm audit` y resolver lo crítico antes de la fecha.

## Contexto

`npm audit` reporta 3 vulnerabilidades altas, las tres resueltas por la misma
actualización: `next` 16.2.9 → 16.3.2 (arrastra `postcss` y `sharp` actualizados).

`next` en sí mismo está listado como vulnerable, con una lista larga de avisos reales —
no boilerplate de transitivas. El más relevante para este proyecto:

**GHSA-6gpp-xcg3-4w24 / CVE-2026-64642 — bypass de autorización en middleware/proxy.**
"Solicitudes manipuladas contra apps de Next.js con App Router, compiladas con
Turbopack y un solo locale en `config.i18n.locales`, pueden saltarse la autenticación
basada en middleware/proxy." Afecta 16.0.0–16.2.10; parchado en 16.2.11+.

**Verificado, no asumido, cuánto de esto aplica a WellBox:**

| Condición del aviso | ¿Aplica a WellBox? |
|---|---|
| App Router | Sí |
| Turbopack | Sí — el build ya lo usa por defecto (`▲ Next.js 16.2.9 (Turbopack)`) |
| Un solo locale en `i18n.locales` | Ambiguo — WellBox no tiene **ningún** `i18n` configurado, que no es lo mismo que tener exactamente uno |

No se puede afirmar con certeza que la tercera condición aplique. No hace falta
resolverlo: la actualización cierra la pregunta de todas formas.

**Por qué esto no compromete lo que ya se construyó, aplique o no.** El propio aviso
recomienda como mitigación "mover la autorización a la ruta de datos del servidor en vez
de depender solo del middleware" — que es exactamente el modelo de tres capas de T-001:
`proxy.ts` es solo el chequeo optimista (primera capa), `requireAdmin()`/`requireUser()`
en `lib/auth.ts` es la verificación real (segunda capa), y las políticas RLS de Postgres
son las que de verdad deciden (tercera capa). Se verifica esto explícitamente, no se da
por sentado: simulando un bypass del proxy, ¿la segunda capa sigue bloqueando?

## Criterios de Aceptación

- [x] **CA-1** — `npm audit` reporta 0 vulnerabilidades altas o críticas.
- [x] **CA-2** — `npm run build`, `npm run lint`, `npx tsc --noEmit` siguen limpios.
- [x] **CA-3** — `npm test` (43 pruebas) sigue en verde.
- [x] **CA-4** — `npm run db:verify` (28 verificaciones + concurrencia) sigue en verde.
- [x] **CA-5** — Verificado en el navegador: menú, login, admin y un pedido completo
      siguen funcionando tras la actualización.
- [x] **CA-6** — Se confirma explícitamente que saltarse `proxy.ts` no basta para
      llegar a una ruta protegida: `requireAdmin()` la sigue bloqueando.

## Riesgos y Deuda Técnica

- Es una actualización de versión menor (16.2 → 16.3), pero en un framework con el que
  el propio `AGENTS.md` del repo advierte comportamiento distinto al esperado por
  entrenamiento. Se regresion-testea todo lo verificable antes de dar por cerrado.

## Pendientes Abiertos y Gaps Detectados

**CA-6, cómo se verificó sin explotar la vulnerabilidad real.** No tiene sentido (ni es
apropiado) intentar reproducir un bypass real de `proxy.ts` para "probar" que la segunda
capa aguanta. En su lugar se verificó la propiedad estructural que hace que el bypass no
importe: una cuenta autenticada con rol `customer` pidió `/admin/usuarios` — una ruta
protegida y profunda — y quedó en `/pedido`, no en `/login`. Ese es el comportamiento
específico de `requireAdmin()` evaluando el rol, distinto del "no hay sesión → a
`/login`" que haría el proxy. Confirma que `lib/auth.ts` hace su propia consulta real a
Supabase (`getUser()` + `profiles.role`) sin leer ninguna señal que el proxy haya
dejado — así que aunque la primera capa fuera saltada, la segunda no tiene forma de
enterarse de que lo fue, y sigue decidiendo por su cuenta.

**Todas las suites regresionadas tras la actualización:** `npm run build`, `npm run
lint`, `npx tsc --noEmit`, `npm test` (43/43) y `npm run db:verify` (28/28 + concurrencia
real) — sin cambios necesarios en ningún archivo del proyecto. El salto de versión no
rompió nada verificable.

## Resultados

- **Fecha de cierre:** 2026-08-25
- **Rama:** `feature/npm-audit`
- `next` 16.2.9 → 16.3.2. `npm audit`: 3 altas → **0**.
- Confirmado que WellBox cumple 2 de las 3 condiciones exactas del aviso de bypass de
  middleware (App Router, Turbopack); la tercera (un solo locale en `i18n.locales`) es
  ambigua porque el proyecto no tiene ningún `i18n` configurado — no se afirmó con
  certeza lo que no se pudo verificar con certeza.
- Verificado en vivo que la segunda capa de autorización (`requireAdmin()`) no depende
  de la primera: una cuenta sin rol admin queda bloqueada por rol, no por sesión,
  incluso pensando en el escenario donde la primera capa fallara.
