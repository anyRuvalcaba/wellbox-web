-- Verifica la duplicación de platillos y semanas (T-009).
-- Corre después de verify-rls.sql, que ya dejó creado el admin 3333…

\set ON_ERROR_STOP on

-- ── Datos de partida: una semana con un platillo con opciones ──────────────
insert into menus (id, week_start_date, is_published)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07', false);
insert into menu_days (id, menu_id, day_date, day_label, position) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07', 'Lunes, 7 de septiembre', 0),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-08', 'Martes, 8 de septiembre', 1);
insert into dishes (id, menu_day_id, name, description, price, position)
  values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
          'Avena Café/Plátano', 'Con topping a elegir', 130, 0);
insert into option_groups (id, dish_id, label, type, is_required, position) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Topping', 'single', true, 0),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', '¿Con azúcar?', 'single', false, 1);
insert into option_choices (option_group_id, label, extra_cost, position) values
  ('dddddddd-0000-0000-0000-000000000001', 'Almendras', 15, 0),
  ('dddddddd-0000-0000-0000-000000000001', 'Nuez', 20, 1),
  ('dddddddd-0000-0000-0000-000000000002', 'Sí', 0, 0);

-- ── Etiquetas de día en español ────────────────────────────────────────────
do $$
begin
  if public.day_label_es('2026-09-07') <> 'Lunes, 7 de septiembre' then
    raise exception 'ETIQUETA FALLA: dio "%"', public.day_label_es('2026-09-07');
  end if;
  -- miércoles lleva acento y va después de mayúscula inicial
  if public.day_label_es('2026-09-09') <> 'Miércoles, 9 de septiembre' then
    raise exception 'ETIQUETA FALLA: dio "%"', public.day_label_es('2026-09-09');
  end if;
  -- Comparar contra un literal NO basta: si este archivo sufriera el mismo problema de
  -- codificación que la migración, el error coincidiría consigo mismo y la prueba
  -- pasaría en falso. Ya ocurrió: `pbcopy` con LC_CTYPE=C convirtió la é en dos
  -- caracteres al pasar la migración a Supabase, y la comparación literal no lo vio.
  --
  -- Contar caracteres y bytes sí lo detecta: 'Miércoles, 9 de septiembre' son 26
  -- caracteres y 27 bytes, porque la é ocupa dos bytes en UTF-8. Si la é llegó rota,
  -- son 27 caracteres y 29 bytes.
  if length(public.day_label_es('2026-09-09')) <> 26
     or octet_length(public.day_label_es('2026-09-09')) <> 27 then
    raise exception 'ETIQUETA FALLA: la é está mal codificada — % caracteres, % bytes (deben ser 26 y 27)',
      length(public.day_label_es('2026-09-09')),
      octet_length(public.day_label_es('2026-09-09'));
  end if;

  raise notice 'ETIQUETAS OK — español correcto, con la é en un solo carácter';
end $$;

-- ── Copiar un platillo se lleva sus opciones ───────────────────────────────
-- set_config con `true` deja el valor solo para esta transacción: es como llega el
-- token de la admin en una petición real, y is_admin() lo lee de ahí.
do $$
declare
  copiado uuid;
  grupos int;
  opciones int;
begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);

  copiado := public.clone_dish_into_day(
    'cccccccc-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002'
  );

  select count(*) into grupos from option_groups where dish_id = copiado;
  select count(*) into opciones
    from option_choices oc join option_groups og on og.id = oc.option_group_id
    where og.dish_id = copiado;

  if grupos <> 2 then
    raise exception 'COPIA FALLA: se esperaban 2 grupos de opciones, hay %', grupos;
  end if;
  if opciones <> 3 then
    raise exception 'COPIA FALLA: se esperaban 3 opciones, hay %', opciones;
  end if;
  if (select price from dishes where id = copiado) <> 130 then
    raise exception 'COPIA FALLA: no se copió el precio';
  end if;
  if (select name from dishes where id = copiado) <> 'Avena Café/Plátano' then
    raise exception 'COPIA FALLA: no se copió el nombre';
  end if;
  raise notice 'COPIA OK — el platillo llegó con sus 2 grupos y sus 3 opciones';
end $$;

-- ── Duplicar la semana completa ────────────────────────────────────────────
do $$
declare
  nueva uuid;
  dias int;
  platillos int;
begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);

  nueva := public.duplicate_menu_week(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-05', false
  );

  select count(*) into dias from menu_days where menu_id = nueva;
  select count(*) into platillos
    from dishes d join menu_days md on md.id = d.menu_day_id where md.menu_id = nueva;

  if dias <> 5 then
    raise exception 'SEMANA FALLA: se esperaban 5 días, hay %', dias;
  end if;
  if (select is_published from menus where id = nueva) then
    raise exception 'SEMANA FALLA: la copia nació publicada — debe ser borrador';
  end if;
  if (select day_label from menu_days where menu_id = nueva and position = 0) <> 'Lunes, 5 de octubre' then
    raise exception 'SEMANA FALLA: la etiqueta del primer día quedó mal: "%"',
      (select day_label from menu_days where menu_id = nueva and position = 0);
  end if;
  -- el lunes de origen traía el platillo original; el martes, la copia del bloque anterior
  if platillos <> 2 then
    raise exception 'SEMANA FALLA: se esperaban 2 platillos copiados, hay %', platillos;
  end if;
  -- y cada copia debe traer sus opciones, no solo el nombre
  if (select count(*) from option_groups og
      join dishes d on d.id = og.dish_id
      join menu_days md on md.id = d.menu_day_id
      where md.menu_id = nueva) <> 4 then
    raise exception 'SEMANA FALLA: los platillos copiados perdieron sus grupos de opciones';
  end if;
  raise notice 'SEMANA OK — 5 días, fechas recorridas, platillos con opciones, sin publicar';
end $$;

-- ── Una clienta no puede duplicar nada ─────────────────────────────────────
do $$
declare
  bloqueado boolean := false;
begin
  begin
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
    execute 'set local role authenticated';
    perform public.duplicate_menu_week('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-02', false);
  exception when insufficient_privilege then
    bloqueado := true;
  end;
  execute 'reset role';
  if not bloqueado then
    raise exception 'PERMISOS FALLA: una clienta duplicó un menú';
  end if;
  raise notice 'PERMISOS OK — duplicar exige rol admin, aunque la función sea security definer';
end $$;
