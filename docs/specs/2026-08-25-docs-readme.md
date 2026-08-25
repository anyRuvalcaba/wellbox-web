# Spec: README — pase completo de actualización

## Metadata
- **Tipo:** docs
- **Complejidad:** S
- **Fecha:** 2026-08-25
- **Estado:** DONE

## Historia

Como **evaluadora**, leo el README antes de la sesión de defensa (así lo dice el propio
documento de evaluación). Quiero que lo que dice sea cierto ahora mismo, no una foto de
cómo era el proyecto en la semana 1.

## Contexto

Encontrado de paso en T-005: el README arrastra afirmaciones falsas desde antes de
T-001 y T-011 ("no hay registro público", "sin pasarela de pago"), y su árbol de
"Estructura del proyecto" no menciona nada de lo construido en T-001 a T-013: roles,
puntos de entrega, stock, Stripe, pruebas, ni los documentos de `docs/`.

## Criterios de Aceptación

- [x] **CA-1** — Ninguna frase del README contradice el estado actual del código.
- [x] **CA-2** — El árbol de "Estructura del proyecto" refleja los directorios reales.
- [x] **CA-3** — Setup de Stripe documentado: llaves de prueba, webhook local con la
      CLI, y la llave de servicio de Supabase con su advertencia.
- [x] **CA-4** — El README enlaza a `docs/backlog.md` y `docs/defensa-tecnica.md`, para
      que alguien que lo lea encuentre el resto de la documentación sin buscarla.
- [x] **CA-5** — Todos los comandos que el README le pide correr al lector existen tal
      cual en `package.json`.

## Pendientes Abiertos y Gaps Detectados

Ninguno. Se verificó con grep que no queda ninguna de las tres frases falsas
identificadas ("no hay registro", "sin pasarela", "solo transferencia"), que cada
comando mencionado existe tal cual en `package.json`, y que cada ruta del árbol de
"Estructura del proyecto" existe de verdad en el repo — no se revisó a ojo.

## Resultados

- **Fecha de cierre:** 2026-08-25
- **Rama:** `feature/readme`
- Reescrito: setup de Stripe (llaves de prueba, CLI, webhook), corrección del flujo de
  registro (ya es público), estructura del proyecto actualizada, sección de
  documentación enlazando `docs/backlog.md` y `docs/defensa-tecnica.md`, decisiones de
  diseño ampliadas con lo construido en T-001 a T-013.
