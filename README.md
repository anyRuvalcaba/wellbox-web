# WellBox — pedidos semanales

App de pedidos para WellBox (Healthy Lunch, Aguascalientes). Dos lados:

- **`/pedido`** — flujo del cliente: ve el menú de la semana, arma su pedido día por día con
  opciones personalizables, llena sus datos y sube su comprobante de transferencia.
- **`/admin`** — panel del equipo WellBox: arma el menú semanal, lo publica, ve los pedidos y
  actualiza el estatus de pago, y edita los datos de pago / WhatsApp.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth, Storage).
Pagos: solo transferencia bancaria + comprobante (sin pasarela de pago).

> Este proyecto usa **Next.js 16**, que renombró `middleware.ts` a `proxy.ts` y cambió algunas
> convenciones respecto a versiones anteriores. Si editas el proyecto, revisa
> `node_modules/next/dist/docs/` antes de asumir comportamiento de versiones previas.

## Variables de entorno

Copia `.env.example` a `.env.local` y llena con los datos de tu proyecto de Supabase
(Project Settings → API):

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-o-publishable-key
```

Ambas son seguras de exponer al cliente (son las claves públicas); el acceso real está
controlado por Row Level Security en Postgres (ver `supabase/migrations/0001_init.sql`).

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (o usa uno existente).
2. En el SQL Editor del proyecto, corre el contenido de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Esto crea las
   tablas, las políticas de RLS y los buckets de Storage (`dish-photos` público,
   `payment-proofs` privado).
3. (Opcional) Corre [`supabase/seed.sql`](supabase/seed.sql) para cargar una semana de ejemplo
   con las opciones personalizables del omelette poblano y la avena con café. Ajusta las fechas
   en el archivo a una semana futura real antes de correrlo.
4. Crea el o los usuarios admin en **Authentication → Users → Add user**, marcando
   "Auto Confirm User". Con ese correo/contraseña entran a `/admin/login`. (No hay registro
   público — los usuarios se crean a mano en el dashboard de Supabase, ya que el panel es
   solo para el equipo de 2 personas).
5. En **Authentication → Sign In / Providers**, desactiva "Enable email confirmations" si
   quieres poder crear usuarios admin sin flujo de correo.
6. Copia la URL y la `anon`/`publishable` key del proyecto a tu `.env.local`.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — redirige a `/pedido`. El panel admin está
en `/admin/login`.

## Desplegar en Vercel

1. Sube este repo a GitHub.
2. En Vercel, "Add New Project" → importa el repo.
3. Agrega las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en Project Settings → Environment Variables.
4. Deploy. No se necesita configuración adicional — es un proyecto Next.js estándar.
5. Genera el código QR apuntando a `https://tu-dominio.vercel.app/pedido`.

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
  pedido/            Flujo del cliente (menú, resumen, pago, confirmación)
  admin/
    (auth)/login/    Login del panel
    (dashboard)/     Panel protegido: inicio, pedidos, menú, ajustes
  api/
    orders/          Crea pedidos (revalida precios y corte en el servidor)
    menu/publish/    Publica/despublica una semana
lib/
  supabase/          Clientes de Supabase (browser, server, proxy)
  cutoff.ts           Lógica de corte de pedidos
  whatsapp.ts          Genera el link de WhatsApp con el resumen del pedido
  types.ts             Tipos de dominio (menú, carrito, etc.)
supabase/
  migrations/0001_init.sql   Esquema completo + RLS + Storage
  seed.sql                   Semana de ejemplo
```

## Decisiones de diseño

- **Un platillo por día**: el cliente elige un solo platillo por día (de las 1–3 opciones que
  publique el admin), no varios. Coincide con el modelo de "una comida saludable al día".
- **Solo un menú publicado a la vez**: forzado con un índice único parcial en Postgres
  (`menus.is_published`).
- **Carrito sin backend de sesión**: se guarda en `sessionStorage` del navegador mientras el
  cliente arma su pedido; solo se escribe en la base de datos hasta confirmar el pago.
- **Login admin con Supabase Auth**: pensado para 2 cuentas (el equipo WellBox). No hay
  registro público.
