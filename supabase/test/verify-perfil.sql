-- Verifica puntos de entrega y métodos de pago (T-002).
-- Corre después de verify-rls.sql: Ana (1111…), Beto (2222…) y la admin (3333…) ya existen.

\set ON_ERROR_STOP on

-- ── Los tres puntos quedaron cargados ──────────────────────────────────────
do $$
begin
  if (select count(*) from delivery_locations where is_active) <> 3 then
    raise exception 'PUNTOS FALLA: se esperaban 3 puntos activos, hay %',
      (select count(*) from delivery_locations where is_active);
  end if;
  raise notice 'PUNTOS OK — los tres puntos de entrega están cargados';
end $$;

-- ── CA-4: la clienta puede fijar su punto la primera vez ───────────────────
do $$
declare
  penal uuid;
begin
  select id into penal from delivery_locations order by position limit 1;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  execute 'set local role authenticated';

  update profiles set delivery_location_id = penal
    where id = '11111111-1111-1111-1111-111111111111';

  execute 'reset role';

  if (select delivery_location_id from profiles
      where id = '11111111-1111-1111-1111-111111111111') is null then
    raise exception 'CA-4 FALLA: la clienta no pudo fijar su punto de entrega — no podría registrarse';
  end if;
  raise notice 'CA-4 OK — la clienta fija su punto de entrega la primera vez';
end $$;

-- ── CA-3: pero no puede cambiarlo después ──────────────────────────────────
do $$
declare
  otro uuid;
  quedo uuid;
  original uuid;
begin
  select delivery_location_id into original from profiles
    where id = '11111111-1111-1111-1111-111111111111';
  select id into otro from delivery_locations
    where id <> original order by position limit 1;

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  execute 'set local role authenticated';
  update profiles set delivery_location_id = otro
    where id = '11111111-1111-1111-1111-111111111111';
  execute 'reset role';

  select delivery_location_id into quedo from profiles
    where id = '11111111-1111-1111-1111-111111111111';

  if quedo <> original then
    raise exception 'CA-3 FALLA: la clienta se cambió de punto de entrega por su cuenta';
  end if;
  raise notice 'CA-3 OK — la clienta ya no puede cambiar su punto de entrega';
end $$;

-- ── Pero un admin sí ───────────────────────────────────────────────────────
do $$
declare
  otro uuid;
  original uuid;
begin
  select delivery_location_id into original from profiles
    where id = '11111111-1111-1111-1111-111111111111';
  select id into otro from delivery_locations where id <> original order by position limit 1;

  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  update profiles set delivery_location_id = otro
    where id = '11111111-1111-1111-1111-111111111111';

  if (select delivery_location_id from profiles
      where id = '11111111-1111-1111-1111-111111111111') <> otro then
    raise exception 'ADMIN FALLA: el admin no pudo cambiar el punto de entrega';
  end if;
  raise notice 'ADMIN OK — el admin sí puede mover a una clienta de punto';
end $$;

-- ── CA-7: no existe dónde guardar CVV ni número completo ───────────────────
do $$
declare
  prohibidas text[] := array['cvv','card_number','cardnumber','pan','card_cvv','security_code'];
  col text;
begin
  foreach col in array prohibidas loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'payment_methods' and column_name = col
    ) then
      raise exception 'CA-7 FALLA: existe la columna payment_methods.% — dato de tarjeta que no se debe almacenar', col;
    end if;
  end loop;
  raise notice 'CA-7 OK — no hay columna para CVV ni para el número completo de tarjeta';
end $$;

-- ── Una tarjeta sin marca ni últimos 4 no se puede guardar ─────────────────
do $$
declare
  rechazado boolean := false;
begin
  begin
    insert into payment_methods (user_id, type, label)
    values ('11111111-1111-1111-1111-111111111111', 'card', 'Tarjeta sin datos');
  exception when check_violation then
    rechazado := true;
  end;
  if not rechazado then
    raise exception 'RESTRICCIÓN FALLA: se guardó una tarjeta sin marca ni últimos 4';
  end if;
  raise notice 'RESTRICCIÓN OK — una tarjeta exige marca y últimos cuatro dígitos';
end $$;

-- ── Un solo método predeterminado por usuario ──────────────────────────────
insert into payment_methods (user_id, type, label, card_brand, card_last4, is_default)
values ('11111111-1111-1111-1111-111111111111', 'card', 'Mi BBVA', 'visa', '4242', true);

do $$
declare
  rechazado boolean := false;
begin
  begin
    insert into payment_methods (user_id, type, label, is_default)
    values ('11111111-1111-1111-1111-111111111111', 'cash', 'Efectivo', true);
  exception when unique_violation then
    rechazado := true;
  end;
  if not rechazado then
    raise exception 'DEFAULT FALLA: una clienta quedó con dos métodos predeterminados';
  end if;
  raise notice 'DEFAULT OK — un solo método predeterminado por clienta, garantizado por la base';
end $$;

-- ── CA-8: el hueco que el proyecto del curso sí tiene ──────────────────────
-- deletePaymentMethod del curso hace findByIdAndDelete(id) sin comprobar dueño, y
-- updatePaymentMethod nunca compara contra el usuario del token. Esta prueba verifica
-- que aquí eso no se puede, aunque Beto conozca el id exacto de la tarjeta de Ana.
do $$
declare
  tarjeta_de_ana uuid;
  sigue_existiendo boolean;
  etiqueta text;
begin
  select id into tarjeta_de_ana from payment_methods
    where user_id = '11111111-1111-1111-1111-111111111111' and type = 'card';

  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  execute 'set local role authenticated';

  -- Beto ve los métodos de pago de Ana?
  if exists (select 1 from payment_methods where user_id = '11111111-1111-1111-1111-111111111111') then
    execute 'reset role';
    raise exception 'CA-8 FALLA: Beto está viendo los métodos de pago de Ana';
  end if;

  -- Beto intenta modificar y borrar la tarjeta de Ana, conociendo su id
  update payment_methods set label = 'Secuestrada' where id = tarjeta_de_ana;
  delete from payment_methods where id = tarjeta_de_ana;

  execute 'reset role';

  select exists (select 1 from payment_methods where id = tarjeta_de_ana) into sigue_existiendo;
  select label into etiqueta from payment_methods where id = tarjeta_de_ana;

  if not sigue_existiendo then
    raise exception 'CA-8 FALLA: Beto borró la tarjeta de Ana';
  end if;
  if etiqueta <> 'Mi BBVA' then
    raise exception 'CA-8 FALLA: Beto modificó la tarjeta de Ana';
  end if;
  raise notice 'CA-8 OK — nadie lee, modifica ni borra los métodos de pago de otra persona';
end $$;

-- ── Los puntos activos se leen sin sesión; los inactivos no ────────────────
insert into delivery_locations (name, address, is_active, position)
values ('Punto Cerrado', 'Ya no operamos aquí', false, 99);

do $$
declare
  visibles int;
begin
  execute 'set local role anon';
  select count(*) into visibles from delivery_locations;
  execute 'reset role';

  if visibles <> 3 then
    raise exception 'PUNTOS ANON FALLA: sin sesión se ven % puntos, deberían ser los 3 activos', visibles;
  end if;
  raise notice 'PUNTOS ANON OK — el registro lista los puntos activos, y los inactivos quedan ocultos';
end $$;

-- ── Pero nadie sin rol admin los puede modificar ───────────────────────────
do $$
declare
  nombre_original text;
begin
  select name into nombre_original from delivery_locations order by position limit 1;

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  execute 'set local role authenticated';
  update delivery_locations set name = 'Secuestrado' where position = 0;
  execute 'reset role';

  if (select name from delivery_locations where position = 0) <> nombre_original then
    raise exception 'PUNTOS FALLA: una clienta modificó un punto de entrega';
  end if;
  raise notice 'PUNTOS ESCRITURA OK — solo un admin puede editar los puntos de entrega';
end $$;

-- ── Cambiar el predeterminado es atómico y solo sobre lo propio ────────────
do $$
declare
  tarjeta uuid;
  efectivo uuid;
begin
  select id into tarjeta from payment_methods
    where user_id = '11111111-1111-1111-1111-111111111111' and type = 'card';

  insert into payment_methods (user_id, type, label)
  values ('11111111-1111-1111-1111-111111111111', 'cash', 'Efectivo')
  returning id into efectivo;

  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  perform public.set_default_payment_method(efectivo);

  if (select count(*) from payment_methods
      where user_id = '11111111-1111-1111-1111-111111111111' and is_default) <> 1 then
    raise exception 'DEFAULT FALLA: quedó más de un predeterminado, o ninguno';
  end if;
  if not (select is_default from payment_methods where id = efectivo) then
    raise exception 'DEFAULT FALLA: el nuevo método no quedó como predeterminado';
  end if;
  if (select is_default from payment_methods where id = tarjeta) then
    raise exception 'DEFAULT FALLA: el método anterior conservó el predeterminado';
  end if;
  raise notice 'CAMBIO DEFAULT OK — cambiar predeterminado deja exactamente uno';
end $$;

do $$
declare
  ajeno uuid;
  bloqueado boolean := false;
begin
  select id into ajeno from payment_methods
    where user_id = '11111111-1111-1111-1111-111111111111' limit 1;

  begin
    perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
    perform public.set_default_payment_method(ajeno);
  exception when insufficient_privilege then
    bloqueado := true;
  end;

  if not bloqueado then
    raise exception 'DEFAULT FALLA: Beto cambió el predeterminado de Ana';
  end if;
  raise notice 'DEFAULT AJENO OK — no se puede tocar el predeterminado de otra persona';
end $$;
