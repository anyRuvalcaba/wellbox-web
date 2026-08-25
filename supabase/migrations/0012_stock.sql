-- T-003 — Stock disponible por platillo.
-- Spec: docs/specs/2026-08-24-feature-stock.md

-- Nulo = sin límite. No todos los platillos tienen tope, y obligar a poner un número en
-- todos convertiría un dato opcional en una fuente de errores.
alter table dishes add column stock int check (stock is null or stock >= 0);

comment on column dishes.stock is
  'Cajas que se pueden preparar de este platillo. NULL = sin límite.';

-- ─────────────────────────────────────────────────────────────────────────
-- Disponibilidad calculada, no descontada
--
-- Se calcula como stock menos lo pedido en pedidos VIVOS, en vez de bajar un contador
-- al crear el pedido y subirlo al cancelarlo.
--
-- La razón es concreta: un pedido puede quedar 'failed' (tarjeta rechazada) o
-- 'cancelled' (checkout abandonado). Con un contador, cada uno de esos caminos
-- necesitaría lógica que devuelva el stock, y el que se olvide deja inventario fantasma
-- que nadie puede comprar y nadie sabe por qué. Calculándolo, cancelar devuelve el stock
-- solo.
-- ─────────────────────────────────────────────────────────────────────────

-- 'pending' SÍ consume: si no, dos clientas podrían llegar al checkout por la última
-- caja al mismo tiempo y las dos pasarían. Es lo mismo que apartar el producto mientras
-- se paga.
create or replace function public.estados_que_consumen_stock()
returns text[]
language sql
immutable
as $$
  select array['pending', 'transfer_uploaded', 'confirmed', 'paid'];
$$;

-- El `filter (where o.id is not null)` no es opcional: con un LEFT JOIN, poner la
-- condición del estado en el ON deja la fila de order_items presente aunque el pedido no
-- califique, y `sum(oi.quantity)` la seguiría contando. El resultado era que cancelar un
-- pedido NO devolvía el stock. Lo detectó la prueba de CA-3.
create or replace view dish_availability as
select
  d.id as dish_id,
  d.menu_day_id,
  d.stock,
  coalesce(sum(oi.quantity) filter (where o.id is not null), 0)::int as reservado,
  case
    when d.stock is null then null
    else greatest(d.stock - coalesce(sum(oi.quantity) filter (where o.id is not null), 0), 0)::int
  end as disponible
from dishes d
left join order_items oi on oi.dish_id = d.id
left join orders o
  on o.id = oi.order_id
  and o.payment_status = any (public.estados_que_consumen_stock())
group by d.id, d.menu_day_id, d.stock;

-- La vista hereda las políticas de las tablas que consulta gracias a security_invoker:
-- sin esto, una vista corre con los permisos de quien la creó y sería una puerta trasera
-- para leer pedidos ajenos.
alter view dish_availability set (security_invoker = true);

grant select on dish_availability to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Comprobación de stock bajo candado
--
-- Entre "verifiqué que hay stock" y "guardé el pedido" caben otras peticiones. Sin un
-- candado, dos clientas pueden ver "queda 1" y las dos crear su pedido.
--
-- Se toma el candado sobre la fila de `dishes`, no sobre `orders`: es el recurso escaso.
-- Las peticiones que quieran el mismo platillo esperan su turno; las de platillos
-- distintos no se estorban.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.verificar_stock(dish_id uuid, cantidad int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Copia local del parámetro: `dish_id` también es el nombre de una columna en
  -- order_items, y Postgres no sabría a cuál se refiere el WHERE de más abajo.
  platillo uuid := dish_id;
  tope int;
  ya_reservado int;
  nombre text;
begin
  -- for update: bloquea esta fila hasta que termine la transacción de quien llama.
  select d.stock, d.name into tope, nombre
  from dishes d where d.id = platillo
  for update;

  if nombre is null then
    raise exception 'El platillo ya no existe' using errcode = 'no_data_found';
  end if;

  if tope is null then return; end if;

  select coalesce(sum(oi.quantity), 0) into ya_reservado
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.dish_id = platillo
    and o.payment_status = any (public.estados_que_consumen_stock());

  if ya_reservado + cantidad > tope then
    raise exception 'Solo quedan % de %', greatest(tope - ya_reservado, 0), nombre
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.verificar_stock(uuid, int) from public, anon;
revoke execute on function public.estados_que_consumen_stock() from public, anon;
grant execute on function public.verificar_stock(uuid, int) to authenticated;
grant execute on function public.estados_que_consumen_stock() to authenticated;
