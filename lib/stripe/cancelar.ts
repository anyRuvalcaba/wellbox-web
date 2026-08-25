import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cancela los checkouts con tarjeta que la clienta dejó a medias antes de empezar uno
// nuevo, para que no se acumulen pedidos sin pagar.
//
// El caso real no es "abandoné el martes y vuelvo el viernes": es una tarjeta rechazada
// seguida de otro intento, o una recarga de página, todo en cuestión de minutos.
//
// Escribe con la llave de servicio por la misma razón que verificarPagoDelPedido:
// cancelar un pedido es una acción del sistema. La política de `orders` no deja que la
// clienta escriba en el suyo — con razón, porque si pudiera, podría marcarlo pagado.
//
// Solo toca pedidos de ESTA clienta, de ESTE menú, que están 'pending' y tienen un cobro
// de tarjeta asociado. Nunca toca transferencias ni efectivo: esos esperan una acción
// del equipo, no de Stripe.
export async function cancelarCheckoutsAbandonados(
  userId: string,
  menuId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { data: abandonados } = await supabase
    .from("orders")
    .select("id, stripe_payment_intent_id")
    .eq("user_id", userId)
    .eq("menu_id", menuId)
    .eq("payment_status", "pending")
    .not("stripe_payment_intent_id", "is", null);

  if (!abandonados?.length) return 0;

  let cancelados = 0;

  for (const pedido of abandonados) {
    try {
      const intento = await stripe.paymentIntents.retrieve(pedido.stripe_payment_intent_id!);

      // Un cobro que ya salió bien NO se toca: sería cancelar un pedido pagado. Puede
      // pasar si el webhook todavía no llega — por eso se pregunta a Stripe en vez de
      // confiar en el estado guardado.
      if (intento.status === "succeeded" || intento.status === "processing") continue;

      if (intento.status !== "canceled") {
        await stripe.paymentIntents.cancel(pedido.stripe_payment_intent_id!, {
          cancellation_reason: "abandoned",
        });
      }

      await supabase
        .from("orders")
        .update({ payment_status: "cancelled" })
        .eq("id", pedido.id);

      cancelados++;
    } catch {
      // Que falle la limpieza de uno no debe impedir que la clienta haga su pedido
      // nuevo. Queda como pendiente visible, que es el estado seguro.
      continue;
    }
  }

  return cancelados;
}
