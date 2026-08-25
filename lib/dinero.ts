// Puro, sin dependencias externas — a propósito. lib/stripe/server.ts revienta al
// importarse si falta STRIPE_SECRET_KEY (correcto en producción: falla rápido y claro),
// pero eso significa que cualquier prueba que lo importara reventaría al cargar el
// archivo, antes de probar nada. aCentavos() no necesita el SDK de Stripe para nada,
// así que vive aparte.

export const MONEDA = "mxn";

// WellBox cobra en pesos mexicanos. Stripe recibe el importe en la unidad mínima de la
// moneda, así que $155.00 son 15500 centavos.
//
// Se redondea con Math.round y no con parseInt: los totales salen de sumar precios que
// Postgres devuelve como numeric, y un 154.99999 truncado cobraría un peso de menos.
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
