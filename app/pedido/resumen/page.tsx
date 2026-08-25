"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../cart-context";
import { formatMXN } from "@/lib/format";
import { BTN_PRIMARY, CHIP_DANGER, TEXT_LINK } from "@/lib/ui";
import QuantityStepper from "../QuantityStepper";

export default function ResumenPage() {
  const cart = useCart();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = cart.customer;

  if (cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-brown/70 mb-4">Aún no has seleccionado ningún platillo.</p>
        <Link href="/pedido" className={TEXT_LINK}>
          Ver el menú
        </Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Nombre y teléfono son obligatorios.");
      return;
    }
    setError(null);
    router.push("/pedido/pago");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark text-center">Resumen de tu pedido</h1>

      <div className="bg-white/70 border border-peach rounded-2xl p-4 flex flex-col gap-3">
        {cart.items.map((item) => {
          const lineUnit = item.unitPrice + item.selectedOptions.reduce((s, o) => s + o.extraCost, 0);
          return (
            <div key={item.dayDate} className="border-b border-peach/40 last:border-0 pb-3 last:pb-0">
              <div className="flex justify-between items-start gap-2">
                <p className="font-semibold">
                  {item.dayLabel}: {item.dishName}
                </p>
                <p className="font-semibold text-rust whitespace-nowrap">{formatMXN(lineUnit * item.quantity)}</p>
              </div>
              {item.selectedOptions.length > 0 && (
                <ul className="text-sm text-brown/60 mt-1">
                  {item.selectedOptions.map((o) => (
                    <li key={o.choiceId}>
                      {o.groupLabel}: {o.choiceLabel}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brown/60">Cantidad</span>
                  <QuantityStepper
                    quantity={item.quantity}
                    onChange={(q) => cart.setItemQuantity(item.dayDate, q)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/pedido" className={`text-sm ${TEXT_LINK}`}>
                    Cambiar
                  </Link>
                  <button
                    type="button"
                    onClick={() => cart.removeDayItem(item.dayDate)}
                    className={CHIP_DANGER}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex justify-between pt-2">
          <p className="font-bold">Total</p>
          <p className="font-bold text-rust">{formatMXN(cart.total)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-semibold block mb-1">Nombre completo</label>
          <input
            className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
            value={form.name}
            onChange={(e) => cart.setCustomer({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">Teléfono (WhatsApp)</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10 dígitos, ej. 4491234567"
            className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
            value={form.phone}
            onChange={(e) => cart.setCustomer({ ...form, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
            required
          />
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">Notas especiales para tu entrega (opcional)</label>
          <textarea
            className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
            rows={2}
            placeholder="Dirección, referencias, alergias, instrucciones especiales, etc."
            value={form.notes}
            onChange={(e) => cart.setCustomer({ ...form, notes: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className={`${BTN_PRIMARY} w-full py-3`}>
          Continuar a pago
        </button>
      </form>
    </div>
  );
}
