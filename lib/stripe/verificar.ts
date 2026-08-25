import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Resultado = "paid" | "pending" | "failed" | "desconocido";

// Única fuente de verdad sobre si un pedido se pagó: se le pregunta a Stripe.
//
// Escribe con la llave de servicio, y la razón es la misma que en el webhook: marcar un
// pedido como pagado es una acción del SISTEMA, no de la clienta. La política de
// `orders` solo permite actualizar a un admin — con razón, porque si una clienta pudiera
// escribir en su propio pedido, podría marcarlo pagado sin pagar.
//
// Lo que autoriza esta escritura no es una sesión: es la respuesta de Stripe. El cliente
// puede llamar a cualquier endpoint con cualquier cuerpo, pero no puede hacer que Stripe
// diga que un cobro ocurrió.
//
// Quien la llama debe haber verificado antes que el pedido es de quien pregunta.
// Es idempotente: que lleguen el webhook y la pantalla de confirmación es lo esperado.
export async function verificarPagoDelPedido(orderId: string): Promise<Resultado> {
  const supabase = createAdminClient();

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
