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

// WellBox cobra en pesos mexicanos. Stripe recibe el importe en la unidad mínima de la
// moneda, así que $155.00 son 15500 centavos.
//
// Se redondea con Math.round y no con parseInt: los totales salen de sumar precios que
// Postgres devuelve como numeric, y un 154.99999 truncado cobraría un peso de menos.
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export const MONEDA = "mxn";
