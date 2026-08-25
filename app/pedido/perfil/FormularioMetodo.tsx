"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MARCAS, type MarcaTarjeta, type TipoPago } from "@/lib/pagos";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/lib/ui";

// Se usa igual en el perfil y en el checkout: la clienta puede agregar una tarjeta sin
// salirse de donde está.
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
  const [tipo, setTipo] = useState<TipoPago>("card");
  const [marca, setMarca] = useState<MarcaTarjeta>("visa");
  const [ultimos4, setUltimos4] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    if (tipo === "card" && !/^[0-9]{4}$/.test(ultimos4)) {
      setError("Escribe los últimos 4 dígitos de tu tarjeta.");
      return;
    }

    setGuardando(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("payment_methods")
      .insert({
        user_id: userId,
        type: tipo,
        label: etiqueta.trim() || null,
        card_brand: tipo === "card" ? marca : null,
        card_last4: tipo === "card" ? ultimos4 : null,
        // El primero queda predeterminado solo: si no, la clienta tendría que dar un
        // paso extra para algo que es obvio.
        is_default: primerMetodo,
      })
      .select("id")
      .single();

    setGuardando(false);

    if (insertError || !data) {
      setError("No se pudo guardar el método de pago.");
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
          <option value="card">Tarjeta de crédito o débito</option>
          <option value="transfer">Transferencia bancaria</option>
          <option value="cash">Efectivo</option>
        </select>
      </div>

      {tipo === "card" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="marca" className="text-sm font-semibold block mb-1">
                Marca
              </label>
              <select
                id="marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value as MarcaTarjeta)}
                className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
              >
                {MARCAS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label htmlFor="ultimos4" className="text-sm font-semibold block mb-1">
                Últimos 4
              </label>
              <input
                id="ultimos4"
                inputMode="numeric"
                maxLength={4}
                value={ultimos4}
                onChange={(e) => setUltimos4(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="4242"
                className="w-full rounded-lg border border-peach px-3 py-2"
              />
            </div>
          </div>

          {/* Explicarlo evita que parezca que se nos olvidó pedir la tarjeta completa. */}
          <p className="text-xs text-brown/60 bg-cream-dark/40 rounded-lg px-3 py-2">
            Solo te pedimos los últimos 4 dígitos, para que reconozcas cuál tarjeta es. No
            guardamos el número completo ni el código de seguridad.
          </p>
        </>
      )}

      <div>
        <label htmlFor="etiqueta" className="text-sm font-semibold block mb-1">
          Nombre para identificarlo <span className="font-normal text-brown/50">(opcional)</span>
        </label>
        <input
          id="etiqueta"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Mi BBVA, Tarjeta del trabajo..."
          className="w-full rounded-lg border border-peach px-3 py-2"
        />
      </div>

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
