-- T-013 — Pedidos abandonados en el checkout con tarjeta.
--
-- Cada intento de pago con tarjeta crea un pedido en 'pending' antes de cobrar. Es una
-- decisión deliberada: garantiza que nunca exista un cobro sin pedido. El costo es que
-- un checkout abandonado —o una tarjeta rechazada seguida de un reintento— deja pedidos
-- sin pagar acumulándose.
--
-- No se implementa "retomar pedido" porque no aplica a este negocio: los pedidos caducan
-- con el cierre de las 11pm, el menú cambia cada semana, y el importe del cobro queda
-- congelado desde que se crea. Lo que sí aplica es que no se acumulen.
--
-- 'cancelled' distingue un pedido que la clienta abandonó de uno que falló al cobrar.
alter table orders drop constraint orders_payment_status_check;
alter table orders add constraint orders_payment_status_check
  check (payment_status in (
    'pending', 'transfer_uploaded', 'confirmed', 'paid', 'failed', 'cancelled'
  ));

comment on column orders.payment_status is
  'pending: esperando pago | transfer_uploaded: comprobante recibido | confirmed: pago verificado a mano | paid: cobrado por Stripe | failed: la tarjeta fue rechazada | cancelled: la clienta abandonó el checkout y empezó otro';
