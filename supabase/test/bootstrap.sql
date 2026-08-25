-- ⚠️  SOLO PARA PRUEBAS LOCALES. Nunca correr esto contra Supabase.
--
-- Supabase es Postgres más un conjunto de piezas que él mismo provee: el esquema
-- `auth`, el esquema `storage`, y los roles `anon` / `authenticated` que RLS usa para
-- distinguir quién consulta. Un Postgres recién instalado no tiene nada de eso, así
-- que las migraciones fallarían en la primera línea que diga `to authenticated`.
--
-- Este archivo crea la versión mínima de esas piezas para poder correr las migraciones
-- reales y verificar que las políticas se comportan como esperamos, sin internet y sin
-- tocar la base de producción.
--
-- Es el equivalente a lo que hace `mongodb-memory-server` en el proyecto del curso:
-- una base desechable que las pruebas levantan solas.
--
-- Límite conocido: esto valida la LÓGICA de las políticas, no reproduce Supabase al
-- 100%. Después de aplicar una migración al proyecto real hay que hacer prueba de humo
-- allá.

create extension if not exists "pgcrypto";

-- ── Roles que Supabase crea por su cuenta ──────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

-- ── auth.users ─────────────────────────────────────────────────────────────
-- Solo las columnas que WellBox realmente usa. Supabase tiene ~30 más.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── auth.uid() ─────────────────────────────────────────────────────────────
-- Réplica del comportamiento de Supabase: lee el `sub` del JWT, que llega como
-- parámetro de sesión. En las pruebas se simula con:
--   set local request.jwt.claims = '{"sub":"<uuid>"}';
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

-- ── storage ────────────────────────────────────────────────────────────────
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;
