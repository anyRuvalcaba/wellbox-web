-- T-011 — Pago en línea con tarjeta.
-- Spec: docs/specs/2026-08-24-feature-pago-en-linea.md

-- ─────────────────────────────────────────────────────────────────────────
-- Stripe es el dueño de las tarjetas
--
-- El Payment Element de Stripe, con una CustomerSession, ya muestra las tarjetas
-- guardadas de la clienta, la deja elegir, agregar y borrar. Duplicar marca y últimos 4
-- en esta base sería garantizar que algún día no coincidan con lo que Stripe tiene.
--
-- payment_methods conserva solo las formas que WellBox opera por su cuenta.
-- ─────────────────────────────────────────────────────────────────────────

alter table profiles add column stripe_customer_id text;

-- Las tarjetas capturadas a mano (marca y últimos 4) no son cobrables: nunca existieron
-- en Stripe. Se eliminan. Los pedidos que las referencian conservan su etiqueta gracias
-- a payment_method_label — que es exactamente para lo que se guardó esa copia.
delete from payment_methods where type = 'card';

alter table payment_methods drop constraint tarjeta_identificable;
alter table payment_methods drop constraint sin_datos_de_tarjeta_si_no_es_tarjeta;
alter table payment_methods drop column card_brand;
alter table payment_methods drop column card_last4;

alter table payment_methods drop constraint payment_methods_type_check;
alter table payment_methods add constraint payment_methods_type_check
  check (type in ('cash', 'transfer'));

-- ─────────────────────────────────────────────────────────────────────────
-- Rastro del cobro en el pedido
-- ─────────────────────────────────────────────────────────────────────────

alter table orders add column stripe_payment_intent_id text;
alter table orders add column payment_error text;

create index orders_stripe_payment_intent_id_idx
  on orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- 'paid' lo pone el servidor tras consultarle a Stripe el estado del PaymentIntent,
-- nunca por lo que diga el navegador. 'failed' guarda el motivo para que la clienta
-- sepa qué pasó en vez de quedarse con un pedido en el limbo.
alter table orders drop constraint orders_payment_status_check;
alter table orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'transfer_uploaded', 'confirmed', 'paid', 'failed'));
