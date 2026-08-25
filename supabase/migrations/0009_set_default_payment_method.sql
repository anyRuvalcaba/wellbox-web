-- T-002 (seguimiento) — Cambiar el método de pago predeterminado.
--
-- Son dos operaciones: quitarle el default al anterior y ponérselo al nuevo. El índice
-- único parcial impide que ambos lo tengan a la vez, así que el orden importa. Hechas
-- por separado desde el cliente, un fallo entre una y otra deja a la clienta sin ningún
-- método predeterminado.
--
-- Como función, las dos ocurren en la misma transacción.

create or replace function public.set_default_payment_method(method_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  duenio uuid;
begin
  -- security definer salta RLS, así que la propiedad se verifica a mano. Sin esto,
  -- cualquiera podría cambiar el predeterminado de otra persona conociendo el id.
  select user_id into duenio from payment_methods where id = method_id;

  if duenio is null then
    raise exception 'Ese método de pago no existe';
  end if;
  if duenio <> auth.uid() then
    raise exception 'Ese método de pago no es tuyo'
      using errcode = 'insufficient_privilege';
  end if;

  update payment_methods set is_default = false
    where user_id = duenio and is_default and id <> method_id;
  update payment_methods set is_default = true where id = method_id;
end;
$$;

revoke execute on function public.set_default_payment_method(uuid) from public, anon;
grant execute on function public.set_default_payment_method(uuid) to authenticated;
