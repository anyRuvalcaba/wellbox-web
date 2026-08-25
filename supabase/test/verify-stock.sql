-- Verifica el stock disponible (T-003).
-- Corre después de verify-rls.sql: Ana (1111…) y Beto (2222…) ya existen.

\set ON_ERROR_STOP on

-- Un platillo con tope de 2 cajas.
insert into menus (id, week_start_date, is_published)
  values ('eeeeeeee-0000-0000-0000-000000000001', '2026-11-02', false);
insert into menu_days (id, menu_id, day_date, day_label, position)
  values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
          '2026-11-02', 'Lunes, 2 de noviembre', 0);
insert into dishes (id, menu_day_id, name, price, position, stock)
  values ('0a0a0a0a-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
          'Bowl Limitado', 100, 0, 2);

-- Y uno sin tope, para comprobar que nulo significa sin límite.
insert into dishes (id, menu_day_id, name, price, position, stock)
  values ('0a0a0a0a-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001',
          'Bowl Ilimitado', 100, 1, null);

-- ── CA-2: la disponibilidad arranca completa ──────────────────────────────
do $$
begin
  if (select disponible from dish_availability where dish_id = '0a0a0a0a-0000-0000-0000-000000000001') <> 2 then
    raise exception 'CA-2 FALLA: sin pedidos deberían quedar 2 disponibles';
  end if;
  if (select disponible from dish_availability where dish_id = '0a0a0a0a-0000-0000-0000-000000000002') is not null then
    raise exception 'CA-2 FALLA: un platillo sin tope debe reportar disponibilidad nula (sin límite)';
  end if;
  raise notice 'CA-2 OK — la disponibilidad arranca completa y nulo significa sin límite';
end $$;

-- ── Un pedido vivo consume stock ──────────────────────────────────────────
insert into orders (id, customer_name, customer_phone, total, user_id, payment_status)
  values ('0b0b0b0b-0000-0000-0000-000000000001', 'Ana', '449', 100,
          '11111111-1111-1111-1111-111111111111', 'pending');
insert into order_items (order_id, dish_id, dish_name, day_label, day_date, unit_price, quantity)
  values ('0b0b0b0b-0000-0000-0000-000000000001', '0a0a0a0a-0000-0000-0000-000000000001',
          'Bowl Limitado', 'Lunes', '2026-11-02', 100, 1);

do $$
begin
  if (select disponible from dish_availability where dish_id = '0a0a0a0a-0000-0000-0000-000000000001') <> 1 then
    raise exception 'CA-2 FALLA: con 1 pedida deberían quedar 1, hay %',
      (select disponible from dish_availability where dish_id = '0a0a0a0a-0000-0000-0000-000000000001');
  end if;
  raise notice 'PENDING OK — un pedido sin pagar ya aparta su caja';
end $$;

-- ── CA-3: cancelar devuelve el stock, sin código que lo recuerde ──────────
do $$
declare
  tras_cancelar int;
  tras_fallar int;
  tras_revivir int;
begin
  update orders set payment_status = 'cancelled' where id = '0b0b0b0b-0000-0000-0000-000000000001';
  select disponible into tras_cancelar from dish_availability
    where dish_id = '0a0a0a0a-0000-0000-0000-000000000001';

  update orders set payment_status = 'failed' where id = '0b0b0b0b-0000-0000-0000-000000000001';
  select disponible into tras_fallar from dish_availability
    where dish_id = '0a0a0a0a-0000-0000-0000-000000000001';

  update orders set payment_status = 'paid' where id = '0b0b0b0b-0000-0000-0000-000000000001';
  select disponible into tras_revivir from dish_availability
    where dish_id = '0a0a0a0a-0000-0000-0000-000000000001';

  if tras_cancelar <> 2 then
    raise exception 'CA-3 FALLA: cancelar no devolvió el stock (quedaron %)', tras_cancelar;
  end if;
  if tras_fallar <> 2 then
    raise exception 'CA-3 FALLA: una tarjeta rechazada no devolvió el stock (quedaron %)', tras_fallar;
  end if;
  if tras_revivir <> 1 then
    raise exception 'CA-3 FALLA: marcar pagado no volvió a consumir el stock (quedaron %)', tras_revivir;
  end if;
  raise notice 'CA-3 OK — cancelar y fallar devuelven el stock; pagar lo vuelve a consumir, sin lógica compensatoria';
end $$;

-- ── CA-7: el servidor rechaza lo que exceda el tope ───────────────────────
do $$
declare
  rechazado boolean := false;
  mensaje text;
begin
  -- Queda 1 (hay un pedido pagado por 1 de un tope de 2). Pedir 2 debe fallar.
  begin
    perform public.verificar_stock('0a0a0a0a-0000-0000-0000-000000000001', 2);
  exception when check_violation then
    rechazado := true;
    get stacked diagnostics mensaje = message_text;
  end;

  if not rechazado then
    raise exception 'CA-7 FALLA: se aceptaron 2 cuando solo queda 1';
  end if;
  if position('Bowl Limitado' in mensaje) = 0 then
    raise exception 'CA-7 FALLA: el mensaje no dice de qué platillo se trata: "%"', mensaje;
  end if;
  raise notice 'CA-7 OK — el servidor rechaza el exceso y dice cuántas quedan: "%"', mensaje;
end $$;

-- ── Pedir justo lo que queda sí pasa ──────────────────────────────────────
do $$
begin
  perform public.verificar_stock('0a0a0a0a-0000-0000-0000-000000000001', 1);
  perform public.verificar_stock('0a0a0a0a-0000-0000-0000-000000000002', 9999);
  raise notice 'LÍMITE OK — se acepta justo lo que queda, y sin tope no hay límite';
end $$;

-- ── Una clienta no puede tocar el stock ───────────────────────────────────
do $$
declare
  tope_original int;
begin
  select stock into tope_original from dishes where id = '0a0a0a0a-0000-0000-0000-000000000001';

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  execute 'set local role authenticated';
  update dishes set stock = 999 where id = '0a0a0a0a-0000-0000-0000-000000000001';
  execute 'reset role';

  if (select stock from dishes where id = '0a0a0a0a-0000-0000-0000-000000000001') <> tope_original then
    raise exception 'FALLA: una clienta cambió el stock de un platillo';
  end if;
  raise notice 'STOCK ESCRITURA OK — solo un admin puede cambiar el stock';
end $$;

-- ── CA-9: crear_pedido es atómico — un fallo no deja nada escrito ─────────
do $$
declare
  pedidos_antes int;
  items_antes int;
  rechazado boolean := false;
begin
  select count(*) into pedidos_antes from orders;
  select count(*) into items_antes from order_items;

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  execute 'set local role authenticated';

  begin
    -- A esta altura Bowl Limitado tiene 1 disponible (tope 2, 1 ya pagado en la
    -- prueba de CA-3). Pedir 2 excede lo que queda y debe fallar sin dejar nada escrito.
    perform public.crear_pedido(
      'eeeeeeee-0000-0000-0000-000000000001', 'Ana', '449', null,
      null, null, null, 'Efectivo', 'pending', null, null, 200,
      jsonb_build_array(jsonb_build_object(
        'dish_id', '0a0a0a0a-0000-0000-0000-000000000001',
        'dish_name', 'Bowl Limitado', 'day_label', 'Lunes', 'day_date', '2026-11-02',
        'unit_price', 100, 'quantity', 2, 'options', '[]'::jsonb
      ))
    );
  exception when check_violation then
    rechazado := true;
  end;

  execute 'reset role';

  if not rechazado then
    raise exception 'CA-9 FALLA: crear_pedido aceptó un platillo agotado';
  end if;
  if (select count(*) from orders) <> pedidos_antes then
    raise exception 'CA-9 FALLA: quedó un pedido a medias tras el rechazo por stock';
  end if;
  if (select count(*) from order_items) <> items_antes then
    raise exception 'CA-9 FALLA: quedaron renglones huérfanos tras el rechazo por stock';
  end if;
  raise notice 'CA-9 OK — un pedido rechazado por stock no deja nada escrito';
end $$;

-- ── crear_pedido con stock disponible sí completa las tres tablas ─────────
do $$
declare
  pedido_nuevo uuid;
  renglones int;
begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  execute 'set local role authenticated';

  pedido_nuevo := public.crear_pedido(
    'eeeeeeee-0000-0000-0000-000000000001', 'Beto', '449', 'sin cubiertos',
    null, null, null, 'Efectivo', 'pending', null, null, 100,
    jsonb_build_array(jsonb_build_object(
      'dish_id', '0a0a0a0a-0000-0000-0000-000000000002',
      'dish_name', 'Bowl Ilimitado', 'day_label', 'Lunes', 'day_date', '2026-11-02',
      'unit_price', 100, 'quantity', 3,
      'options', jsonb_build_array(jsonb_build_object(
        'group_label', 'Extras', 'choice_label', 'Miel', 'extra_cost', 5
      ))
    ))
  );

  execute 'reset role';

  if (select user_id from orders where id = pedido_nuevo) <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'CREAR_PEDIDO FALLA: el pedido no quedó a nombre de quien lo creó';
  end if;
  select count(*) into renglones from order_items where order_id = pedido_nuevo;
  if renglones <> 1 then
    raise exception 'CREAR_PEDIDO FALLA: se esperaba 1 renglón, hay %', renglones;
  end if;
  if (select count(*) from order_item_options oi
      join order_items it on it.id = oi.order_item_id
      where it.order_id = pedido_nuevo) <> 1 then
    raise exception 'CREAR_PEDIDO FALLA: no se guardó la opción del renglón';
  end if;
  raise notice 'CREAR_PEDIDO OK — pedido, renglón y opción quedaron completos en una sola llamada';
end $$;
