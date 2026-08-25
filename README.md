# WellBox — pedidos semanales

App de pedidos para WellBox (Healthy Lunch, Aguascalientes). Dos lados:

- **`/pedido`** — flujo del cliente: se registra o inicia sesión, ve el menú de la
  semana, arma su pedido día por día con opciones personalizables (respetando el stock
  disponible), y paga con tarjeta en línea, transferencia con comprobante, o efectivo al
  recibir.
- **`/admin`** — panel del equipo WellBox: arma el menú semanal y lo publica (con la
  opción de duplicar una semana anterior), administra el stock por platillo, ve los
  pedidos y confirma pagos, gestiona los tres puntos de entrega fijos, cambia roles de
  usuario, y edita los datos de pago / WhatsApp.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (Postgres, Auth,
Storage) + Stripe (cobro en línea con tarjeta, modo de prueba).

> Este proyecto usa **Next.js 16**, que renombró `middleware.ts` a `proxy.ts` y cambió algunas
> convenciones respecto a versiones anteriores. Si editas el proyecto, revisa
> `node_modules/next/dist/docs/` antes de asumir comportamiento de versiones previas.

## Documentación del proyecto

Más allá de este README:

- [`docs/backlog.md`](docs/backlog.md) — qué se construyó, en qué orden y por qué; el
  estado de cada fase.
- [`docs/specs/`](docs/specs/) — un spec por fase, con las decisiones de diseño, lo que
  se consideró y se descartó, y cómo se verificó cada una.
- [`docs/defensa-tecnica.md`](docs/defensa-tecnica.md) — el porqué de las decisiones que
  más se prestan a preguntas: por qué Postgres y no MongoDB, por qué Stripe es dueño de
  las tarjetas, por qué la autorización vive en tres capas y no solo en el proxy, qué
  bugs aparecieron en el camino y qué enseñó cada uno.

## Variables de entorno

Copia `.env.example` a `.env.local` y llena con tus propias claves:

```bash
cp .env.example .env.local
```

### Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-o-publishable-key
```

Ambas son seguras de exponer al cliente (son las claves públicas); el acceso real está
controlado por Row Level Security en Postgres (ver
[`supabase/migrations/`](supabase/migrations/)).

```
SUPABASE_SERVICE_ROLE_KEY=tu-llave-de-servicio
```

Esta **no** es pública: salta todas las políticas de RLS. Solo la usa
[`app/api/stripe/webhook/route.ts`](app/api/stripe/webhook/route.ts), porque esa
petición la manda el servidor de Stripe sin sesión de nadie — no hay otra forma de que
escriba en la base. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni llegar al navegador.
Está en Supabase → Project Settings → API → `service_role`.

### Stripe (modo de prueba)

```
STRIPE_SECRET_KEY=sk_test_tu-llave-secreta
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_tu-llave-publicable
STRIPE_WEBHOOK_SECRET=whsec_tu-secreto-de-webhook
```

Crea una cuenta de Stripe (gratis, el modo de prueba no pide documentos) y cópialas de
**Developers → API keys**. El modo de prueba usa
[tarjetas de prueba oficiales](https://docs.stripe.com/testing) — `4242 4242 4242 4242`
para un cobro que pasa limpio, `4000 0025 0000 3155` para uno que exige autenticación
del banco, `4000 0000 0000 9995` para uno rechazado.

Para el webhook en local, instala la CLI de Stripe y déjala escuchando en una terminal
aparte mientras trabajas:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Ese comando imprime el `whsec_...` que va en `STRIPE_WEBHOOK_SECRET`. Sin el webhook, un
cobro que se completa después de que la clienta cierra la pestaña —por ejemplo, tras
autenticarse con su banco— nunca se refleja en el pedido.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (o usa uno existente).
2. En el SQL Editor del proyecto, corre las migraciones de
   [`supabase/migrations/`](supabase/migrations/) **en orden por su número**. Crean las
   tablas, los roles, las políticas de RLS, los buckets de Storage, los tres puntos de
   entrega y las funciones de Postgres que hacen el trabajo pesado (crear un pedido en
   una sola transacción, verificar y descontar stock con candado, duplicar un menú).

   > **No las pases por el portapapeles del sistema (`pbcopy`).** En una terminal con
   > `LC_CTYPE=C`, `pbcopy` interpreta los bytes UTF-8 como MacRoman y rompe los acentos
   > — `é` llega como `√©`. Ya pasó una vez, con la migración 0006. Ábrelas en un editor
   > de texto y copia desde ahí.

3. (Opcional) Corre [`supabase/seed.sql`](supabase/seed.sql) para cargar una semana de
   ejemplo. Ajusta las fechas del archivo a una semana futura real antes de correrlo.
4. Regístrate desde `/registro` con tu propia app corriendo — el registro es público.
   Para volverte administradora, en el SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
   ```
   Sin este paso te quedas como clienta y no puedes entrar a `/admin`. Desde el panel
   (`/admin/usuarios`) puedes darle rol de admin a más cuentas después.
5. En **Authentication → Sign In / Providers → Email**, decide si quieres exigir
   confirmación por correo. Con volumen bajo y clientas conocidas, suele convenir
   desactivarla — evita que un correo de confirmación perdido en spam le cueste una
   venta al negocio.
6. Copia la URL y la `anon`/`publishable` key del proyecto a tu `.env.local`.

## Aplicar migraciones nuevas

Antes de aplicar cualquier migración a Supabase, córrela contra la base local:

```bash
npm run db:verify
```

Eso recrea una base desechable, corre todas las migraciones en orden, y verifica
seguridad, stock y concurrencia — 28 comprobaciones. Ver
[`supabase/test/`](supabase/test/).

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — redirige a `/pedido`. El registro
está en `/registro`, el login (de clientas y del equipo) en `/login`.

## Pruebas

Hay dos suites, con propósitos distintos — no una sustituye a la otra.

### `npm test` — Vitest

Pruebas unitarias y de componentes, sin dependencias externas: corren en cualquier
máquina con `npm install`, en un par de segundos.

```bash
npm install
npm test
```

Cubre las funciones puras de `lib/` (el corte de pedidos, el formateo de moneda y
fechas, el redondeo a centavos para Stripe, la detección de fallos de conexión) y algún
componente de React — por ejemplo `QuantityStepper`, la pieza de interfaz que evita
pedir más cantidad de la que hay en stock.

`npm run test:watch` corre en modo interactivo mientras se desarrolla;
`npm run test:coverage` agrega un reporte de cobertura.

### `npm run db:verify` — seguridad y concurrencia contra Postgres real

28 verificaciones en SQL: que una clienta no pueda leer los pedidos de otra, que no
pueda ascenderse a administradora, que el stock no se sobrevenda — incluida una prueba
que lanza dos pedidos **simultáneos** por la última unidad de un platillo, con dos
conexiones reales compitiendo, para comprobar que el candado de la base realmente
funciona.

Necesita PostgreSQL 17 instalado (`brew install postgresql@17`) porque reproduce el
esquema mínimo de Supabase (`auth`, `storage`, roles) sobre un Postgres local — no existe
para Postgres un equivalente maduro a `mongodb-memory-server` que levante una instancia
completa embebida en el proceso de pruebas.

```bash
brew install postgresql@17
brew services start postgresql@17
npm run db:verify
```

## Desplegar en Vercel

1. Sube este repo a GitHub.
2. En Vercel, "Add New Project" → importa el repo.
3. Agrega en Project Settings → Environment Variables todas las variables de
   `.env.local`: las de Supabase, las de Stripe, y `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy. No se necesita configuración adicional — es un proyecto Next.js estándar.
5. En el dashboard de Stripe (**Developers → Webhooks**), agrega un endpoint apuntando a
   `https://tu-dominio.vercel.app/api/stripe/webhook`, escuchando
   `payment_intent.succeeded` y `payment_intent.payment_failed`. Copia el secreto que
   genera a `STRIPE_WEBHOOK_SECRET` en Vercel.
6. Genera el código QR apuntando a `https://tu-dominio.vercel.app/pedido`.

## Cómo funciona el corte de pedidos

El corte para pedir el platillo de un día es **11pm del día anterior, hora de Ciudad de
México (UTC-6)**. La lógica vive en [`lib/cutoff.ts`](lib/cutoff.ts): México eliminó el
horario de verano en 2022, así que se usa un offset fijo de UTC-6 en vez de una librería de
zonas horarias. El cliente ve el conteo regresivo al próximo corte y los días ya cerrados
aparecen bloqueados ("No disponible — pedidos cerrados"); el servidor (`/api/orders`) vuelve a
validar el corte antes de guardar el pedido, así que no se puede forzar un pedido tarde
manipulando el cliente.

## Estructura del proyecto

```
app/
  (auth)/
    login/             Login unificado — clientas y equipo, redirige según rol
    registro/          Registro público
  pedido/               Flujo del cliente
    perfil/             Datos, punto de entrega, formas de pago guardadas
    mis-pedidos/         Historial propio
    pago/                Elige forma de pago, cobra con Stripe si es tarjeta
  admin/(dashboard)/     Panel protegido: inicio, pedidos, menú, entregas, usuarios, ajustes
  api/
    orders/              Crea el pedido (revalida precio, corte y stock; una sola transacción)
    stripe/webhook/       Confirma cobros que Stripe procesó sin que la clienta vuelva a la app
    menu/publish/         Publica/despublica una semana
lib/
  auth.ts                Data Access Layer — sesión y rol, la segunda de tres capas de autorización
  db-error.ts             Distingue un fallo de conexión de un vacío legítimo
  dinero.ts                Redondeo a centavos para Stripe
  pagos.ts                  Formas de pago que administra WellBox (no las tarjetas — esas son de Stripe)
  stripe/                    Cliente de Stripe, verificación y cancelación de cobros
  supabase/                   Clientes de Supabase (navegador, servidor, proxy, admin)
  __tests__/                   Pruebas de Vitest
supabase/
  migrations/            Un archivo por cambio de esquema, en orden
  test/                   Verificaciones en SQL + el script de concurrencia real
docs/
  backlog.md              Qué se hizo, en qué orden, por qué
  specs/                    Un documento por fase
  defensa-tecnica.md         El porqué de las decisiones, para la evaluación
```

## Decisiones de diseño

- **Autorización en tres capas**: `proxy.ts` es un chequeo optimista (evita renderizar
  pantallas que el usuario no podrá usar); `lib/auth.ts` hace la verificación real en el
  servidor; las políticas RLS de Postgres son las que de verdad deciden. Si las dos
  primeras fallaran, la base sigue rechazando la consulta — verificado, no solo
  diseñado, en [`docs/defensa-tecnica.md`](docs/defensa-tecnica.md).
- **Un platillo por día**: el cliente elige un solo platillo por día (de las 1–3 opciones
  que publique el admin), no varios. Coincide con el modelo de "una comida saludable al
  día". Sigue siendo un carrito multi-artículo: varios días, cada uno con su cantidad.
- **Solo un menú publicado a la vez**: forzado con un índice único parcial en Postgres
  (`menus.is_published`).
- **Stock calculado, no descontado**: la disponibilidad se calcula restando lo pedido en
  pedidos vivos, en vez de bajar un contador al crear el pedido. Un pedido cancelado o
  con tarjeta rechazada libera su stock solo, sin lógica que lo recuerde.
- **Puntos de entrega fijos, no direcciones libres**: WellBox entrega en tres oficinas
  conocidas, no a domicilio. Cada clienta se asocia a un punto al registrarse y no lo
  puede cambiar después — es su lugar de trabajo.
- **Stripe es dueño de las tarjetas**: WellBox no guarda número de tarjeta ni CVV en
  ningún lado. El Payment Element de Stripe captura la tarjeta directamente y la
  clienta puede guardarla, elegir entre varias o borrarlas desde ahí.
- **Carrito sin backend de sesión**: se guarda en `sessionStorage` del navegador mientras
  el cliente arma su pedido; solo se escribe en la base de datos al confirmar.
- **Crear un pedido es una sola transacción**: candado sobre el platillo, comprobación de
  stock, inserción del pedido y sus renglones — todo en una función de Postgres. Un
  fallo a la mitad no deja nada escrito.
