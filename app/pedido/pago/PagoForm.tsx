"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "../cart-context";
import { createClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/format";
import { describirMetodo, ETIQUETA_TIPO, type MetodoPago } from "@/lib/pagos";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";
import FormularioMetodo from "../perfil/FormularioMetodo";

export default function PagoForm({
  userId,
  metodos,
  banco,
  punto,
}: {
  userId: string;
  metodos: MetodoPago[];
  banco: Record<string, string>;
  punto: { name: string; address: string; notes: string | null } | null;
}) {
  const cart = useCart();
  const router = useRouter();
  const [metodoId, setMetodoId] = useState(metodos.find((m) => m.isDefault)?.id ?? metodos[0]?.id ?? "");
  const [agregando, setAgregando] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metodo = metodos.find((m) => m.id === metodoId) ?? null;
  const esTransferencia = metodo?.type === "transfer";

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

  if (!punto) {
    return (
      <div className="text-center py-16 flex flex-col gap-3">
        <p className="text-brown/70">Antes de pedir necesitas elegir tu punto de entrega.</p>
        <Link href="/pedido/perfil" className={TEXT_LINK}>
          Ir a mi perfil
        </Link>
      </div>
    );
  }

  async function confirmar() {
    if (!metodoId) {
      setError("Elige una forma de pago.");
      return;
    }
    if (esTransferencia && !archivo) {
      setError("Sube tu comprobante de transferencia.");
      return;
    }
    if (!cart.menuId) {
      setError("Tu sesión expiró, vuelve a empezar tu pedido.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const supabase = createClient();
      let rutaComprobante = "";

      if (esTransferencia && archivo) {
        const ext = archivo.name.split(".").pop() || "jpg";
        rutaComprobante = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(rutaComprobante, archivo);

        if (uploadError) {
          setError("No se pudo subir el comprobante. Intenta de nuevo.");
          setEnviando(false);
          return;
        }
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
          paymentMethodId: metodoId,
          transferProofPath: rutaComprobante,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo registrar el pedido.");
        setEnviando(false);
        return;
      }

      cart.clearCart();
      router.push(`/pedido/confirmacion?id=${json.orderId}`);
    } catch {
      setError("Ocurrió un error. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark text-center">Confirma tu pedido</h1>

      <div className="bg-white/70 border border-peach rounded-2xl p-4 text-sm">
        <p className="font-semibold text-rust mb-2">Total: {formatMXN(cart.total)}</p>
        <p className="text-brown/70">
          Entrega en <span className="font-semibold">{punto.name}</span>
        </p>
        <p className="text-xs text-brown/50">{punto.address}</p>
        {punto.notes && <p className="text-xs text-brown/50">{punto.notes}</p>}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">¿Cómo vas a pagar?</h2>
          {!agregando && (
            <button onClick={() => setAgregando(true)} className={TEXT_LINK}>
              + Otra forma de pago
            </button>
          )}
        </div>

        {metodos.length === 0 && !agregando && (
          <p className="text-sm text-brown/60">
            No tienes formas de pago guardadas. Agrega una para continuar.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {metodos.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 border rounded-xl px-3 py-2 cursor-pointer ${
                metodoId === m.id ? "border-olive bg-olive-light/10" : "border-peach bg-white"
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={m.id}
                checked={metodoId === m.id}
                onChange={() => setMetodoId(m.id)}
              />
              <span className="min-w-0">
                <span className="font-semibold block truncate">{describirMetodo(m)}</span>
                <span className="text-xs text-brown/50">{ETIQUETA_TIPO[m.type]}</span>
              </span>
            </label>
          ))}
        </div>

        {agregando && (
          <FormularioMetodo
            userId={userId}
            primerMetodo={metodos.length === 0}
            onCancelar={() => setAgregando(false)}
            onListo={(nuevoId) => {
              // Se selecciona sola la que acaba de agregar: es a la que quiere cambiarse.
              setMetodoId(nuevoId);
              setAgregando(false);
              router.refresh();
            }}
          />
        )}
      </section>

      {/* Cada forma de pago necesita decir qué pasa después. Sin esto, la clienta se
          queda con la duda de si ya pagó o no. */}
      {metodo?.type === "transfer" && (
        <section className="flex flex-col gap-3">
          <div className="bg-white/70 border border-peach rounded-2xl p-4 flex flex-col gap-1 text-sm">
            <Dato etiqueta="CLABE" valor={banco.bank_clabe} />
            <Dato etiqueta="Banco" valor={banco.bank_name} />
            <Dato etiqueta="Beneficiario" valor={banco.bank_holder} />
            {banco.bank_reference_note && (
              <p className="text-brown/60 mt-2">{banco.bank_reference_note}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold block mb-2">Comprobante de transferencia</label>
            <label
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer text-center ${
                archivo ? "border-olive bg-olive-light/10" : "border-peach bg-white hover:bg-peach-light/40"
              }`}
            >
              <span className="text-2xl">📎</span>
              <span className="text-sm font-semibold text-olive-dark">
                {archivo ? archivo.name : "Toca para subir tu comprobante"}
              </span>
              {!archivo && (
                <span className="text-xs text-brown/50">Foto o captura de tu transferencia</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
        </section>
      )}

      {metodo?.type === "cash" && (
        <p className="text-sm text-brown/70 bg-cream-dark/40 rounded-xl px-4 py-3">
          Recibimos tu pago cuando entreguemos tu pedido en {punto.name}. Te recomendamos
          llevar el monto exacto: {formatMXN(cart.total)}.
        </p>
      )}

      {/* El pago con tarjeta debe cobrarse en línea al confirmar el pedido, pero todavía
          no hay pasarela conectada. Decirlo de frente es mejor que dar a entender que el
          cobro ya ocurrió: en un checkout, dejar a la clienta con la duda de si le
          cobraron o no es el peor resultado posible. Ver T-011 en el backlog. */}
      {metodo?.type === "card" && (
        <p className="text-sm text-brown/70 bg-peach-light/60 rounded-xl px-4 py-3">
          Tu pedido queda registrado con <span className="font-semibold">pago pendiente</span>.
          El cobro en línea todavía no está activo, así que te contactamos por WhatsApp
          para completarlo. <span className="font-semibold">Aún no se te cobra nada.</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={confirmar}
        disabled={enviando || !metodoId}
        className={`${BTN_PRIMARY} w-full py-3`}
      >
        {enviando ? "Enviando..." : "Confirmar pedido"}
      </button>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  if (!valor) return null;
  return (
    <p>
      <span className="font-semibold">{etiqueta}:</span> {valor}
    </p>
  );
}
