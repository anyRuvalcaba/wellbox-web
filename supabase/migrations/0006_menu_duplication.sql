-- T-009 — Reutilizar platillos y semanas anteriores al armar el menú.
--
-- Copiar un platillo son tres inserciones encadenadas (dishes → option_groups →
-- option_choices). Hacerlas desde el cliente deja la puerta abierta a un platillo a
-- medias si algo falla entre una y otra. Como funciones de Postgres, cada copia es una
-- sola transacción: se completa o no ocurre.
--
-- Van como security definer con verificación explícita de is_admin(). Sin esa
-- verificación, security definer saltaría RLS y cualquier sesión podría escribir en el
-- catálogo.

-- ── Etiqueta de día en español ─────────────────────────────────────────────
-- No se usa to_char(): depende de la configuración regional del servidor, que no
-- controlamos. Esto produce el mismo texto que formatDayLabel() en lib/format.ts.
create or replace function public.day_label_es(fecha date)
returns text
language sql
immutable
as $$
  select upper(left(dia, 1)) || substr(dia, 2) || ', ' ||
         extract(day from fecha)::int::text || ' de ' || mes
  from (
    select
      (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])
        [extract(isodow from fecha)::int] as dia,
      (array['enero','febrero','marzo','abril','mayo','junio',
             'julio','agosto','septiembre','octubre','noviembre','diciembre'])
        [extract(month from fecha)::int] as mes
  ) partes;
$$;

-- ── Copiar un platillo a un día ────────────────────────────────────────────
create or replace function public.clone_dish_into_day(
  source_dish_id uuid,
  target_menu_day_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_platillo uuid;
  grupo record;
  nuevo_grupo uuid;
  siguiente_posicion int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede copiar platillos'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(position) + 1, 0) into siguiente_posicion
  from dishes where menu_day_id = target_menu_day_id;

  insert into dishes (menu_day_id, name, description, price, photo_url, position)
  select target_menu_day_id, name, description, price, photo_url, siguiente_posicion
  from dishes where id = source_dish_id
  returning id into nuevo_platillo;

  if nuevo_platillo is null then
    raise exception 'El platillo que intentas copiar ya no existe';
  end if;

  -- Aquí está el ahorro real de tiempo: los grupos de opciones y sus alternativas.
  for grupo in
    select * from option_groups where dish_id = source_dish_id order by position
  loop
    insert into option_groups (dish_id, label, type, is_required, position)
    values (nuevo_platillo, grupo.label, grupo.type, grupo.is_required, grupo.position)
    returning id into nuevo_grupo;

    insert into option_choices (option_group_id, label, extra_cost, position)
    select nuevo_grupo, label, extra_cost, position
    from option_choices where option_group_id = grupo.id;
  end loop;

  return nuevo_platillo;
end;
$$;

-- ── Duplicar una semana completa ───────────────────────────────────────────
-- El menú nuevo NUNCA nace publicado: se crea como borrador para poder ajustarlo antes
-- de que las clientas lo vean.
create or replace function public.duplicate_menu_week(
  source_menu_id uuid,
  new_week_start date,
  include_saturday boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_menu uuid;
  dia record;
  nuevo_dia uuid;
  fecha date;
  total_dias int;
  indice int := 0;
  platillo record;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede duplicar menús'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from menus where id = source_menu_id) then
    raise exception 'La semana que intentas duplicar ya no existe';
  end if;

  total_dias := case when include_saturday then 6 else 5 end;

  insert into menus (week_start_date, is_published)
  values (new_week_start, false)
  returning id into nuevo_menu;

  for dia in
    select * from menu_days where menu_id = source_menu_id order by position, day_date
  loop
    exit when indice >= total_dias;
    fecha := new_week_start + indice;

    insert into menu_days (menu_id, day_date, day_label, position)
    values (nuevo_menu, fecha, public.day_label_es(fecha), indice)
    returning id into nuevo_dia;

    for platillo in
      select id from dishes where menu_day_id = dia.id order by position
    loop
      perform public.clone_dish_into_day(platillo.id, nuevo_dia);
    end loop;

    indice := indice + 1;
  end loop;

  -- Si la semana de origen tenía menos días que los pedidos, se completan vacíos para
  -- que el editor los muestre y se puedan llenar a mano.
  while indice < total_dias loop
    fecha := new_week_start + indice;
    insert into menu_days (menu_id, day_date, day_label, position)
    values (nuevo_menu, fecha, public.day_label_es(fecha), indice);
    indice := indice + 1;
  end loop;

  return nuevo_menu;
end;
$$;

-- Mismo criterio que 0004/0005: solo authenticated, y adentro se exige admin.
revoke execute on function public.day_label_es(date) from public, anon;
revoke execute on function public.clone_dish_into_day(uuid, uuid) from public, anon;
revoke execute on function public.duplicate_menu_week(uuid, date, boolean) from public, anon;
grant execute on function public.clone_dish_into_day(uuid, uuid) to authenticated;
grant execute on function public.duplicate_menu_week(uuid, date, boolean) to authenticated;
