"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/format";
import { buildOrderConfirmedMessage, buildPendingPaymentMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { getCutoff } from "@/lib/cutoff";
import { CHIP_OLIVE, TEXT_LINK } from "@/lib/ui";
import type { OrderRow } from "./page";

const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const COLUMN_COUNT = 7;

const STATUS_OPTIONS: { value: string; icon: string; label: string }[] = [
  { value: "pending", icon: "✕", label: "Pendiente" },
  { value: "transfer_uploaded", icon: "⏳", label: "Recibido" },
  { value: "confirmed", icon: "✓", label: "Confirmado" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-cream-dark text-brown",
  transfer_uploaded: "bg-peach text-brown",
  confirmed: "bg-olive text-cream",
};

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="overflow-x-auto bg-white border border-peach rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-peach bg-cream-dark/40">
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Platillo / Día</th>
            <th className="px-3 py-2">Cantidad</th>
            <th className="px-3 py-2">Opciones</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Pago</th>
            <th className="px-3 py-2">Notas</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderRowView key={order.id} order={order} />
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-3 py-6 text-center text-brown/50">
                Aún no hay pedidos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrderRowView({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.paymentStatus);
  const [updating, setUpdating] = useState(false);
  const [now] = useState(() => Date.now());

  const notificationItems = order.items.map((i) => ({
    dayLabel: i.dayLabel,
    dishName: i.dishName,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    options: i.options.map((o) => ({ chosenOptionLabel: o.choiceLabel })),
  }));

  const isUrgent =
    status !== "confirmed" &&
    order.items.some((item) => {
      const msUntilCutoff = getCutoff(item.dayDate).getTime() - now;
      return msUntilCutoff > 0 && msUntilCutoff < URGENT_WINDOW_MS;
    });

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    setStatus(newStatus);
    const supabase = createClient();
    await supabase.from("orders").update({ payment_status: newStatus }).eq("id", order.id);
    setUpdating(false);
    router.refresh();

    if (newStatus === "confirmed") {
      window.open(whatsappLinkFor("confirmed"), "_blank");
    }
  }

  function whatsappLinkFor(forStatus: string) {
    const message =
      forStatus === "confirmed"
        ? buildOrderConfirmedMessage({ customerName: order.customerName, total: order.total, items: notificationItems })
        : buildPendingPaymentMessage({
            customerName: order.customerName,
            notes: order.notes,
            total: order.total,
            items: notificationItems,
          });
    return buildWhatsAppLink(order.customerPhone, message);
  }

  const rowCount = Math.max(order.items.length, 1);

  const clienteCell = (
    <td rowSpan={rowCount} className="px-3 py-3 align-top border-r border-peach/20">
      <p className="font-semibold">{order.customerName}</p>
      <p className="text-brown/50">{order.customerPhone}</p>
    </td>
  );

  const totalCell = (
    <td rowSpan={rowCount} className="px-3 py-3 align-top font-semibold text-rust border-l border-peach/20">
      {formatMXN(order.total)}
    </td>
  );

  const pagoCell = (
    <td rowSpan={rowCount} className="px-3 py-3 align-top">
      <div className="flex flex-col gap-1.5 items-start">
        <select
          value={status}
          disabled={updating}
          onChange={(e) => handleStatusChange(e.target.value)}
          title={STATUS_OPTIONS.find((o) => o.value === status)?.label}
          className={`text-xs font-bold rounded-full px-2 py-1 border-0 cursor-pointer ${STATUS_COLORS[status]}`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
        {isUrgent && <p className="text-[11px] font-semibold text-red-600">⏰ cierra pronto</p>}
        {order.proofSignedUrl ? (
          <a href={order.proofSignedUrl} target="_blank" rel="noreferrer" className={`text-xs ${TEXT_LINK}`}>
            Ver comprobante
          </a>
        ) : (
          <span className="text-brown/30 text-xs">Sin comprobante</span>
        )}
        <a href={whatsappLinkFor(status)} target="_blank" rel="noreferrer" className={CHIP_OLIVE}>
          WhatsApp
        </a>
      </div>
    </td>
  );

  const notasCell = (
    <td rowSpan={rowCount} className="px-3 py-3 align-top border-l border-peach/20">
      {order.notes ? <p className="text-brown/70 italic">{order.notes}</p> : <span className="text-brown/30">—</span>}
    </td>
  );

  if (order.items.length === 0) {
    return (
      <tr className="border-b border-peach/40 align-top">
        {clienteCell}
        <td colSpan={3} className="px-3 py-3 text-brown/40">
          Sin platillos.
        </td>
        {totalCell}
        {pagoCell}
        {notasCell}
      </tr>
    );
  }

  return (
    <>
      {order.items.map((item, i) => (
        <tr key={i} className={`align-top ${i === order.items.length - 1 ? "border-b border-peach/40" : ""}`}>
          {i === 0 && clienteCell}
          <td className="px-3 py-3">
            <span className="font-semibold">{item.dayLabel}:</span> {item.dishName}
          </td>
          <td className="px-3 py-3">{item.quantity}</td>
          <td className="px-3 py-3 text-brown/60">
            {item.options.length > 0 ? item.options.map((o) => o.choiceLabel).join(", ") : "—"}
          </td>
          {i === 0 && totalCell}
          {i === 0 && pagoCell}
          {i === 0 && notasCell}
        </tr>
      ))}
    </>
  );
}
