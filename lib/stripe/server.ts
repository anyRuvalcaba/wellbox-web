import Stripe from "stripe";

// Solo servidor. La llave secreta no lleva prefijo NEXT_PUBLIC_ a propósito: Next solo
// expone al navegador las variables con ese prefijo, así que este archivo no puede
// importarse desde un componente cliente sin que el build falle.
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "Falta STRIPE_SECRET_KEY. Cópiala del dashboard de Stripe (modo prueba) a .env.local."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// aCentavos() y MONEDA viven en lib/dinero.ts: no necesitan el SDK de Stripe, y este
// archivo revienta al importarse sin STRIPE_SECRET_KEY. Se re-exportan aquí para que
// nada que ya los importe de este archivo tenga que cambiar.
export { aCentavos, MONEDA } from "@/lib/dinero";
