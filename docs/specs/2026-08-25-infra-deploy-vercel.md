# Spec: Deploy a Vercel y repo público

## Metadata
- **Tipo:** infra
- **Complejidad:** M
- **Fecha:** 2026-08-25
- **Estado:** DONE

## Historia

Como **evaluadora**, necesito una URL pública con SSL, funcionando contra la base de
datos real, para probar la app antes y durante la sesión de defensa — así lo exige el
documento de evaluación de forma literal.

## Lo que se hizo

1. Repo de GitHub pasado de privado a público, con confirmación explícita antes de
   ejecutarlo (es una acción difícil de revertir del todo — el contenido puede quedar
   cacheado aunque se revierta).
2. Cuenta de Vercel creada por la usuaria (no es algo que se pueda hacer en su nombre) e
   importado el repo desde GitHub.
3. Variables de entorno cargadas a Vercel mediante "Import .env" apuntando directo al
   archivo `.env.local` — evita transcribir secretos a mano o pegarlos en el chat.
4. Deploy inicial.

## Hallazgo mayor — Vercel desplegó el primer commit del proyecto, no el actual

El primer deploy respondió con **404 en `/registro` y `/login`**. La causa: **Vercel
despliega la rama por defecto del repo en GitHub, que era `main`** — y `main` seguía en
el primerísimo commit (`docs: README con setup de Supabase...`, de antes de que
existiera ni el registro ni el login). Los 52 commits reales de T-001 a T-014 vivían
solo en `develop` y sus ramas de feature; nunca se habían fusionado a `main`.

No fue un problema del deploy — fue una decisión de flujo de trabajo desde el principio
del proyecto (trabajar en `develop`, nunca tocar `main` directamente) que nadie había
cerrado hasta que un servicio externo expuso la consecuencia. `main` y `develop` no
tenían commits divergentes: `git merge-base --is-ancestor main develop` confirmó que era
un *fast-forward* limpio, así que se resolvió sin conflictos, con confirmación explícita
antes de hacer push a la rama de producción.

## Segundo hallazgo — el webhook de producción con firma inválida

Tras crear el endpoint del webhook en Stripe y que la usuaria guardara el secreto en
Vercel, una petición firmada con el secreto correcto seguía devolviendo `"Firma
inválida."` en vez de `"Webhook no configurado."` — lo que ya confirmaba que la variable
sí estaba guardada en Vercel, solo que con un valor distinto al esperado (probablemente
un espacio de más al copiar). Se le pidió corregirlo y repetir el redeploy.

**Falso negativo propio en la segunda verificación**, que vale la pena registrar: al
repetir la prueba de firma después de la corrección, siguió fallando. La causa no era
que el arreglo no hubiera funcionado — el encabezado de prueba llevaba un *timestamp* de
varios minutos atrás, y Stripe rechaza firmas fuera de una ventana de tolerancia de 5
minutos por diseño (contra ataques de repetición). `constructEvent()` lanza el mismo
tipo de excepción tanto por firma incorrecta como por timestamp vencido, y el código
las trata igual — así que el mensaje de error no distinguía las dos causas. Generar un
encabezado nuevo, con el timestamp del momento, confirmó que sí estaba corregido.

## Verificación completa contra producción, no solo el sitio cargando

- SSL activo automáticamente (`HTTP/2 200` sobre HTTPS, certificado válido de Vercel).
- Registro público real: cuenta nueva creada desde `/registro` en producción, verificada
  después en la tabla `profiles` de Supabase con su rol y punto de entrega correctos.
- Login real con esa cuenta.
- **Cobro con tarjeta de punta a punta contra producción real**: se creó un pedido de
  $290.00 (dos platillos), se confirmó el cobro con la tarjeta de prueba de Stripe, y el
  webhook de producción — sin ningún navegador de por medio — marcó el pedido como
  `paid`. Verificado tanto en la base de datos como en `/pedido/mis-pedidos`, donde la
  clienta lo ve reflejado.
- Un segundo pedido, cuyo cobro nunca se confirmó a propósito, quedó correctamente en
  "Pago pendiente" — confirma que el webhook solo marca pagado lo que Stripe confirma
  que se cobró, nunca por defecto.

## Riesgos y Deuda Técnica

- El proyecto de Supabase en plan gratuito se pausa solo tras varios días sin actividad,
  y no despierta con una simple visita — hay que restaurarlo a mano desde el dashboard.
  Riesgo ya registrado desde fases anteriores del backlog: restaurarlo y visitarlo a
  diario en los días previos a la evaluación.
- La rama `main` ahora es la fuente de verdad para Vercel. De aquí en adelante, cualquier
  trabajo nuevo tiene que llegar a `main` (vía `develop` fusionado, como hasta ahora)
  para que se refleje en producción — de lo contrario se repite el mismo problema.

## Resultados

- **Fecha de cierre:** 2026-08-25
- URL de producción: `https://wellbox-web.vercel.app`
- Repo público: `https://github.com/anyRuvalcaba/wellbox-web`
- Webhook de Stripe apuntando a producción, verificado con una firma válida generada al
  momento.
- Datos de prueba de esta verificación borrados de la base real al cerrar.
