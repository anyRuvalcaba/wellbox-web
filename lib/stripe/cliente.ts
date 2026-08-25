import { loadStripe, type Stripe } from "@stripe/stripe-js";

// loadStripe se llama una sola vez por carga de página: cada llamada inyecta el script
// de Stripe.js de nuevo.
let promesa: Promise<Stripe | null> | null = null;

export function obtenerStripe() {
  if (!promesa) {
    promesa = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return promesa;
}
