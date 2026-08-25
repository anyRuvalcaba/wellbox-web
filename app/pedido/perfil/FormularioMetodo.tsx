"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TipoPago } from "@/lib/pagos";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/lib/ui";

// Solo efectivo y transferencia. Las tarjetas se agregan desde el checkout, dentro del
// Payment Element de Stripe: ahí el número se captura en un iframe de Stripe y nunca
// pasa por el servidor de WellBox.
export default function FormularioMetodo({
  userId,
  onListo,
  onCancelar,
  primerMetodo,
}: {
  userId: string;
  onListo: (nuevoId: string) => void;
  onCancelar: () => void;
  primerMetodo: boolean;
}) {
  const [tipo, setTipo] = useState<TipoPago>("transfer");
  const [etiqueta, setEtiqueta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("payment_methods")
      .insert({
        user_id: userId,
        type: tipo,
        label: etiqueta.trim() || null,
        // El primero queda predeterminado solo: pedirle un paso extra para algo obvio
        // solo agrega fricción.
        is_default: primerMetodo,
      })
      .select("id")
      .single();

    setGuardando(false);

    if (insertError || !data) {
      setError("No se pudo guardar la forma de pago.");
      return;
    }

    onListo(data.id);
  }

  return (
    <form onSubmit={guardar} className="bg-white border border-peach rounded-xl p-4 flex flex-col gap-3">
      <div>
        <label htmlFor="tipo" className="text-sm font-semibold block mb-1">
          Forma de pago
        </label>
        <select
          id="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPago)}
          className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
        >
          <option value="transfer">Transferencia bancaria</option>
          <option value="cash">Efectivo</option>
        </select>
      </div>

      <div>
        <label htmlFor="etiqueta" className="text-sm font-semibold block mb-1">
          Nombre para identificarla <span className="font-normal text-brown/50">(opcional)</span>
        </label>
        <input
          id="etiqueta"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Mi BBVA, Efectivo..."
          className="w-full rounded-lg border border-peach px-3 py-2"
        />
      </div>

      <p className="text-xs text-brown/60 bg-cream-dark/40 rounded-lg px-3 py-2">
        ¿Vas a pagar con tarjeta? No hace falta guardarla aquí: la capturas al momento de
        pagar y queda guardada de forma segura para tus próximos pedidos.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={`${BTN_PRIMARY} flex-1`}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className={BTN_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
