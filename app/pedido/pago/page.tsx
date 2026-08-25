"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../cart-context";
import { createClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/format";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";

interface BankDetails {
  bank_clabe?: string;
  bank_name?: string;
  bank_holder?: string;
  bank_reference_note?: string;
}

export default function PagoPage() {
  const cart = useCart();
  const router = useRouter();
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["bank_clabe", "bank_name", "bank_holder", "bank_reference_note"])
      .then(({ data }) => {
        const map: BankDetails = {};
        for (const row of data ?? []) {
          (map as Record<string, string>)[row.key] = row.value ?? "";
        }
        setBank(map);
      });
  }, []);

  if (cart.items.length === 0 || !cart.customer.name) {
    return (
      <div className="text-center py-16">
        <p className="text-brown/70 mb-4">Primero completa tu pedido y tus datos.</p>
        <Link href="/pedido" className={TEXT_LINK}>
          Ver el menú
        </Link>
      </div>
    );
  }

  async function handleSubmit() {
    if (!file) {
      setError("Sube tu comprobante de transferencia.");
      return;
    }
    if (!cart.menuId) {
      setError("Tu sesión expiró, vuelve a empezar tu pedido.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file);

      if (uploadError) {
        setError("No se pudo subir el comprobante. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId: cart.menuId,
          customer: cart.customer,
          items: cart.items.map((item) => ({
            dayDate: item.dayDate,
            dishId: item.dishId,
            quantity: item.quantity,
            selectedOptionIds: item.selectedOptions.map((o) => o.choiceId),
          })),
          transferProofPath: path,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo registrar el pedido.");
        setSubmitting(false);
        return;
      }

      const orderId = json.orderId as string;
      cart.clearCart();
      router.push(`/pedido/confirmacion?id=${orderId}`);
    } catch {
      setError("Ocurrió un error. Intenta de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark text-center">Pago por transferencia</h1>

      <div className="bg-white/70 border border-peach rounded-2xl p-4 flex flex-col gap-2 text-sm">
        <p className="font-semibold text-rust mb-1">Total a transferir: {formatMXN(cart.total)}</p>
        {bank ? (
          <>
            <Row label="CLABE" value={bank.bank_clabe} />
            <Row label="Banco" value={bank.bank_name} />
            <Row label="Beneficiario" value={bank.bank_holder} />
            {bank.bank_reference_note && (
              <p className="text-brown/60 mt-2">{bank.bank_reference_note}</p>
            )}
          </>
        ) : (
          <p className="text-brown/50">Cargando datos de pago...</p>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold block mb-2">Comprobante de transferencia</label>
        <label
          className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer text-center ${
            file ? "border-olive bg-olive-light/10" : "border-peach bg-white hover:bg-peach-light/40"
          }`}
        >
          <span className="text-2xl">📎</span>
          <span className="text-sm font-semibold text-olive-dark">
            {file ? file.name : "Toca para subir tu comprobante"}
          </span>
          {!file && <span className="text-xs text-brown/50">Foto o captura de tu transferencia (JPG/PNG)</span>}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={handleSubmit} disabled={submitting} className={`${BTN_PRIMARY} w-full py-3`}>
        {submitting ? "Enviando..." : "Confirmar pedido"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p>
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
}
