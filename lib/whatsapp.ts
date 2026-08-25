import { formatMXN } from "@/lib/format";
import type { OrderItemForNotification } from "@/lib/types";

export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Emoji usados en los mensajes de WhatsApp — cámbialos aquí si quieres otros.
// Usamos 🌿 (la misma hojita del logo) porque es un emoji simple y muy compatible;
// si en tu WhatsApp ves un rombo con "?", normalmente es que tu teléfono/navegador
// no tiene la fuente de ese emoji específico, no un problema del mensaje en sí.
const EMOJI_BRAND = "🌿";

function itemLines(items: OrderItemForNotification[]): string[] {
  return items.map((item) => {
    const optionsText = item.options.length
      ? ` (${item.options.map((o) => o.chosenOptionLabel).join(", ")})`
      : "";
    const qtyText = item.quantity > 1 ? ` ×${item.quantity}` : "";
    return `• ${item.dayLabel}: ${item.dishName}${qtyText}${optionsText} — ${formatMXN(item.unitPrice * item.quantity)}`;
  });
}

// Un solo mensaje para pedidos aún no confirmados: detalle del pedido +
// recordatorio de pago pendiente, para no tener dos botones que hacen lo mismo.
export function buildPendingPaymentMessage(params: {
  customerName: string;
  notes: string | null;
  total: number;
  items: OrderItemForNotification[];
}): string {
  const { customerName, notes, total, items } = params;

  const lines = [
    `Hola ${customerName} ${EMOJI_BRAND}`,
    `Te escribimos de WellBox sobre tu pedido:`,
    "",
    ...itemLines(items),
    "",
    `Total: ${formatMXN(total)}`,
  ];

  if (notes) {
    lines.push("", `Notas de entrega: ${notes}`);
  }

  lines.push(
    "",
    `Tu pago sigue *pendiente de confirmar*. Si ya hiciste tu transferencia, mándanos tu comprobante para confirmarlo. ¡Gracias!`
  );

  return lines.join("\n");
}

export function buildOrderConfirmedMessage(params: {
  customerName: string;
  total: number;
  items: OrderItemForNotification[];
}): string {
  const { customerName, total, items } = params;

  const lines = [
    `¡Hola ${customerName}! ${EMOJI_BRAND}`,
    `Tu pedido WellBox ya quedó *confirmado*. Recibimos tu pago correctamente.`,
    "",
    ...items.map((item) => `• ${item.dayLabel}: ${item.dishName}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`),
    "",
    `Total: ${formatMXN(total)}`,
    "",
    `Te esperamos con tu entrega a las 10am. ¡Gracias por tu pedido!`,
  ];

  return lines.join("\n");
}
