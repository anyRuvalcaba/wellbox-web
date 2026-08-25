import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { verificarPagoDelPedido } from "@/lib/stripe/verificar";

// Webhook de Stripe.
//
// Existe por un caso muy concreto: la clienta paga y cierra la pestaña antes de que la
// app se entere. Sin esto, quedaría un cobro real con un pedido en 'pending' — dinero
// cobrado y una clienta convencida de que su pedido no pasó.
//
// Corre sin sesión de usuario (la petición viene del servidor de Stripe, sin cookies),
// así que usa la llave de servicio. Lo que autentica la petición es la FIRMA de Stripe,
// no una sesión: sin verificarla, cualquiera podría marcar pedidos como pagados con un
// simple POST.
export async function POST(request: Request) {
  const firma = request.headers.get("stripe-signature");
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;

  if (!firma || !secreto) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 });
  }

  // El cuerpo se lee como texto crudo: la firma se calcula sobre los bytes exactos, y
  // parsearlo a JSON antes cambiaría el contenido y la verificación fallaría.
  const cuerpo = await request.text();

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, secreto);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  if (evento.type === "payment_intent.succeeded" || evento.type === "payment_intent.payment_failed") {
    const intento = evento.data.object as Stripe.PaymentIntent;
    const orderId = intento.metadata?.order_id;

    if (orderId) {
      // Se vuelve a consultar el estado en vez de confiar en el cuerpo del evento: es la
      // misma función que usa la pantalla de confirmación, y es idempotente. Que lleguen
      // los dos caminos es lo esperado, no un problema.
      await verificarPagoDelPedido(orderId);
    }
  }

  // Siempre 200 ante un evento que no manejamos: un error haría que Stripe reintente en
  // bucle por algo que no es un fallo.
  return NextResponse.json({ recibido: true });
}
