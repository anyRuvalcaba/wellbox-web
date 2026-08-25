-- T-003 (seguimiento) — Crear un pedido pasa a ser una sola transacción.
--
-- Hasta ahora POST /api/orders insertaba el pedido y cada renglón con llamadas HTTP
-- separadas (una por INSERT). Entre una y otra caben otras peticiones: es exactamente
-- el hueco que T-001 dejó parchado con delete_incomplete_order(), una función acotada
-- que solo borraba pedidos propios y sin renglones si algo fallaba a medias.
--
-- Con la llegada del stock, ese hueco deja de ser tolerable: la comprobación de
-- disponibilidad tiene que ocurrir bajo el mismo candado que la inserción, o dos
-- clientas podrían ver "queda 1" y las dos completar su pedido.
--
-- security invoker (no definer): corre con los permisos de quien llama. Las políticas
-- de insert de orders/order_items/order_item_options ya lo permiten para la propia
-- sesión — no hace falta saltarse RLS para esto, solo agrupar las escrituras en una
-- transacción.
create or replace function public.crear_pedido(
  p_menu_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_delivery_location_id uuid,
  p_delivery_location_name text,
  p_payment_method_id uuid,
  p_payment_method_label text,
  p_payment_status text,
  p_transfer_proof_url text,
  p_stripe_payment_intent_id text,
  p_total numeric,
  -- [{dish_id, dish_name, day_label, day_date, unit_price, quantity,
  --   options: [{group_label, choice_label, extra_cost}]}, ...]
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  nuevo_pedido uuid;
  item jsonb;
  agregado jsonb;
  nuevo_item_id uuid;
  opcion jsonb;
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene platillos' using errcode = 'check_violation';
  end if;

  -- Candado y comprobación de stock ANTES de escribir nada. Se agrupa por platillo y se
  -- suman las cantidades: si el mismo platillo apareciera dos veces en el pedido, pedir
  -- el candado dos veces en la misma transacción no sería un problema (Postgres lo
  -- permite para la misma sesión), pero verificar_stock compararía cada aparición contra
  -- el mismo "ya reservado" sin ver a la otra, y una combinación que individualmente
  -- cabe podría exceder el tope en conjunto.
  for agregado in
    select jsonb_build_object('dish_id', x->>'dish_id', 'quantity', sum((x->>'quantity')::int))
    from jsonb_array_elements(p_items) x
    group by x->>'dish_id'
  loop
    perform public.verificar_stock((agregado->>'dish_id')::uuid, (agregado->>'quantity')::int);
  end loop;

  insert into orders (
    customer_name, customer_phone, notes, total, payment_status,
    transfer_proof_url, menu_id, user_id, delivery_location_id,
    delivery_location_name, payment_method_id, payment_method_label,
    stripe_payment_intent_id, delivery_type, delivery_address
  ) values (
    p_customer_name, p_customer_phone, p_notes, p_total, p_payment_status,
    p_transfer_proof_url, p_menu_id, auth.uid(), p_delivery_location_id,
    p_delivery_location_name, p_payment_method_id, p_payment_method_label,
    p_stripe_payment_intent_id, 'delivery', null
  )
  returning id into nuevo_pedido;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (
      order_id, dish_id, dish_name, day_label, day_date, unit_price, quantity
    ) values (
      nuevo_pedido,
      (item->>'dish_id')::uuid,
      item->>'dish_name',
      item->>'day_label',
      (item->>'day_date')::date,
      (item->>'unit_price')::numeric,
      (item->>'quantity')::int
    )
    returning id into nuevo_item_id;

    for opcion in select * from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb))
    loop
      insert into order_item_options (
        order_item_id, option_group_label, chosen_option_label, extra_cost
      ) values (
        nuevo_item_id,
        opcion->>'group_label',
        opcion->>'choice_label',
        (opcion->>'extra_cost')::numeric
      );
    end loop;
  end loop;

  -- Si algo de lo anterior lanzó una excepción — stock insuficiente, una restricción de
  -- la tabla, lo que sea — Postgres deshace TODO lo que llevaba esta función: no hay
  -- pedido a medias que limpiar. delete_incomplete_order() deja de hacer falta.
  return nuevo_pedido;
end;
$$;

revoke execute on function public.crear_pedido(
  uuid, text, text, text, uuid, text, uuid, text, text, text, text, numeric, jsonb
) from public, anon;
grant execute on function public.crear_pedido(
  uuid, text, text, text, uuid, text, uuid, text, text, text, text, numeric, jsonb
) to authenticated;

-- El parche que ya no hace falta. Su trabajo lo hace ahora el rollback automático de una
-- transacción que falla.
drop function if exists public.delete_incomplete_order(uuid);
