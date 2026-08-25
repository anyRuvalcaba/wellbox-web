import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import type { Database } from "@/lib/database.types";

type Resultado = "paid" | "pending" | "failed" | "desconocido";

// Única fuente de verdad sobre si un pedido se pagó: se le pregunta a Stripe.
//
// Nunca se marca 'paid' porque el navegador lo diga. Un cliente puede llamar a cualquier
// endpoint con cualquier cuerpo; lo que no puede es hacer que Stripe mienta.
//
// La llaman dos caminos: la pantalla de confirmación (cuando la clienta vuelve) y el
// webhook (cuando no vuelve, porque cerró la pestaña). Es idempotente a propósito: que
// los dos lleguen es lo normal, no un problema.
export async function verificarPagoDelPedido(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<Resultado> {
  const { data: pedido } = await supabase
    .from("orders")
    .select("id, payment_status, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!pedido?.stripe_payment_intent_id) return "desconocido";
  if (pedido.payment_status === "paid") return "paid";

  const intento = await stripe.paymentIntents.retrieve(pedido.stripe_payment_intent_id);

  if (intento.status === "succeeded") {
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_error: null })
      .eq("id", orderId);
    return "paid";
  }

  // requires_payment_method después de un intento significa que la tarjeta fue
  // rechazada. Se guarda el motivo para que la clienta sepa qué pasó en vez de quedarse
  // con un pedido en el limbo.
  if (intento.status === "requires_payment_method" && intento.last_payment_error) {
    await supabase
      .from("orders")
      .update({
        payment_status: "failed",
        payment_error: intento.last_payment_error.message ?? "La tarjeta fue rechazada.",
      })
      .eq("id", orderId);
    return "failed";
  }

  return "pending";
}
