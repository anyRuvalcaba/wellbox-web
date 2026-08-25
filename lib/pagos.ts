// Formas de pago que WellBox administra en su propia base.
//
// Las tarjetas NO están aquí: desde T-011 las administra Stripe, que ya guarda, muestra
// y deja borrar las tarjetas de cada clienta desde su Payment Element. Duplicar marca y
// últimos 4 en esta base sería garantizar que algún día no coincidan.
export type TipoPago = "cash" | "transfer";

export interface MetodoPago {
  id: string;
  type: TipoPago;
  label: string | null;
  isDefault: boolean;
}

export const ETIQUETA_TIPO: Record<TipoPago, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

// Identificador que usa el checkout para decir "voy a pagar con tarjeta". No es un id de
// payment_methods porque las tarjetas no viven en esa tabla.
export const PAGO_CON_TARJETA = "card";

export function describirMetodo(metodo: MetodoPago): string {
  return metodo.label?.trim() || ETIQUETA_TIPO[metodo.type];
}
