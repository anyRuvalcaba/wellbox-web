-- Verifica los criterios de aceptación de seguridad del spec T-001.
-- Cada bloque falla ruidosamente: si el script termina, las políticas se comportan.

\set ON_ERROR_STOP on
\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set BETO   '''22222222-2222-2222-2222-222222222222'''
\set ADMIN  '''33333333-3333-3333-3333-333333333333'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:ANA::uuid,   'ana@test.mx',   '{"full_name":"Ana"}'),
  (:BETO::uuid,  'beto@test.mx',  '{"full_name":"Beto"}'),
  (:ADMIN::uuid, 'admin@test.mx', '{"full_name":"Admin"}');

-- ── CA-2: el perfil se crea solo al registrarse ────────────────────────────
do $$
begin
  if (select count(*) from profiles) <> 4 then
    raise exception 'CA-2 FALLA: se esperaban 4 perfiles (3 nuevos + 1 heredada), hay %',
      (select count(*) from profiles);
  end if;
  if (select full_name from profiles where id = '11111111-1111-1111-1111-111111111111') <> 'Ana' then
    raise exception 'CA-2 FALLA: full_name no se copió de raw_user_meta_data';
  end if;
  if (select role from profiles where id = '11111111-1111-1111-1111-111111111111') <> 'customer' then
    raise exception 'CA-2 FALLA: el rol por defecto no es customer';
  end if;
  raise notice 'CA-2 OK — perfil automático con rol customer';
end $$;

-- ── Relleno: las cuentas creadas antes de la migración también tienen perfil ──
do $$
begin
  if not exists (select 1 from profiles where id = '99999999-9999-9999-9999-999999999999') then
    raise exception 'RELLENO FALLA: una cuenta creada antes de la migración se quedó sin perfil — quedaría sin acceso';
  end if;
  if (select full_name from profiles where id = '99999999-9999-9999-9999-999999999999') <> 'Cuenta Heredada' then
    raise exception 'RELLENO FALLA: no se copió el nombre de la cuenta heredada';
  end if;
  raise notice 'RELLENO OK — las cuentas previas a la migración quedan con perfil';
end $$;

-- Alta del primer admin desde contexto de servidor (sin JWT).
update profiles set role = 'admin' where id = :ADMIN::uuid;
do $$
begin
  if (select role from profiles where id = '33333333-3333-3333-3333-333333333333') <> 'admin' then
    raise exception 'BOOTSTRAP FALLA: no se pudo crear el primer admin';
  end if;
  raise notice 'BOOTSTRAP OK — primer admin creado desde contexto de servidor';
end $$;

-- ── CA-3: una clienta no puede volverse admin ──────────────────────────────
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  update profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
commit;

do $$
begin
  if (select role from profiles where id = '11111111-1111-1111-1111-111111111111') <> 'customer' then
    raise exception 'CA-3 FALLA: ESCALACIÓN DE PRIVILEGIOS — una clienta se hizo admin';
  end if;
  raise notice 'CA-3 OK — el intento de auto-ascenso fue revertido';
end $$;

-- ── CA-4: una clienta no puede tocar el catálogo ni los datos bancarios ────
insert into settings (key, value) values ('bank_clabe', '0000-CUENTA-REAL');

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  update settings set value = '9999-CUENTA-DEL-ATACANTE' where key = 'bank_clabe';
commit;

do $$
begin
  if (select value from settings where key = 'bank_clabe') <> '0000-CUENTA-REAL' then
    raise exception 'CA-4 FALLA: una clienta cambió los datos bancarios';
  end if;
  raise notice 'CA-4 OK — settings blindado contra clientas';
end $$;

-- ── CA-5 / CA-6: cada quien ve sus pedidos; el admin ve todos ──────────────
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  insert into orders (customer_name, customer_phone, total, user_id)
    values ('Ana', '4491111111', 100, '11111111-1111-1111-1111-111111111111');
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  insert into orders (customer_name, customer_phone, total, user_id)
    values ('Beto', '4492222222', 200, '22222222-2222-2222-2222-222222222222');
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    if (select count(*) from orders) <> 1 then
      raise exception 'CA-5 FALLA: Ana ve % pedidos, debería ver solo el suyo', (select count(*) from orders);
    end if;
    if (select customer_name from orders) <> 'Ana' then
      raise exception 'CA-5 FALLA: Ana está viendo el pedido de alguien más';
    end if;
    raise notice 'CA-5 OK — cada clienta ve solo sus pedidos';
  end $$;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
  do $$
  begin
    if (select count(*) from orders) <> 2 then
      raise exception 'CA-6 FALLA: el admin ve % pedidos, deberían ser 2', (select count(*) from orders);
    end if;
    raise notice 'CA-6 OK — el admin ve todos los pedidos';
  end $$;
commit;

-- ── Suplantación: Ana no puede crear un pedido a nombre de Beto ────────────
do $$
declare
  ok boolean := false;
begin
  begin
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
    execute 'set local role authenticated';
    insert into orders (customer_name, customer_phone, total, user_id)
      values ('Suplantado', '4490000000', 1, '22222222-2222-2222-2222-222222222222');
  exception when insufficient_privilege then
    ok := true;
  end;
  execute 'reset role';
  if not ok then
    raise exception 'SPOOFING FALLA: Ana creó un pedido a nombre de Beto';
  end if;
  raise notice 'SPOOFING OK — no se puede crear un pedido a nombre de otra persona';
end $$;

-- ── El escape para el servidor no es explotable desde el cliente ───────────
-- protect_role() permite cambiar el rol cuando auth.uid() es nulo. Hay que probar
-- que una petición anónima no puede aprovechar ese camino: RLS la frena antes.
do $$
declare
  bloqueado boolean := false;
begin
  begin
    execute 'set local role anon';
    update profiles set role = 'admin'
      where id = '11111111-1111-1111-1111-111111111111';
  exception when insufficient_privilege then
    bloqueado := true;
  end;
  execute 'reset role';
  if not bloqueado
     and (select role from profiles where id = '11111111-1111-1111-1111-111111111111') <> 'customer' then
    raise exception 'FALLA CRÍTICA: una petición anónima escaló privilegios';
  end if;
  raise notice 'ANON OK — sin identidad no se puede tocar profiles';
end $$;
