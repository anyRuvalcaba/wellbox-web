export type TipoPago = "card" | "cash" | "transfer";
export type MarcaTarjeta = "visa" | "mastercard" | "amex" | "otra";

export interface MetodoPago {
  id: string;
  type: TipoPago;
  label: string | null;
  cardBrand: MarcaTarjeta | null;
  cardLast4: string | null;
  isDefault: boolean;
}

export const ETIQUETA_TIPO: Record<TipoPago, string> = {
  card: "Tarjeta",
  cash: "Efectivo",
  transfer: "Transferencia",
};

export const MARCAS: { valor: MarcaTarjeta; etiqueta: string }[] = [
  { valor: "visa", etiqueta: "Visa" },
  { valor: "mastercard", etiqueta: "Mastercard" },
  { valor: "amex", etiqueta: "American Express" },
  { valor: "otra", etiqueta: "Otra" },
];

const ETIQUETA_MARCA: Record<MarcaTarjeta, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  otra: "Tarjeta",
};

// Texto con el que la clienta reconoce su método de pago. Para tarjetas son la marca y
// los últimos cuatro dígitos — lo único que guardamos, y lo único que hace falta para
// distinguir una tarjeta de otra.
export function describirMetodo(metodo: MetodoPago): string {
  if (metodo.label?.trim()) return metodo.label.trim();
  if (metodo.type === "card" && metodo.cardBrand && metodo.cardLast4) {
    return `${ETIQUETA_MARCA[metodo.cardBrand]} ···· ${metodo.cardLast4}`;
  }
  return ETIQUETA_TIPO[metodo.type];
}

// Lo que se guarda como copia en el pedido: si después borra la tarjeta, el pedido
// sigue diciendo con qué se pagó.
export function etiquetaParaPedido(metodo: MetodoPago): string {
  const base = describirMetodo(metodo);
  if (metodo.type === "card" && metodo.cardLast4 && !base.includes(metodo.cardLast4)) {
    return `${base} (···· ${metodo.cardLast4})`;
  }
  return base;
}
