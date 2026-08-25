"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CHIP_OLIVE, CHIP_OLIVE_OUTLINE } from "@/lib/ui";

interface Punto {
  id: string;
  name: string;
  address: string;
  notes: string | null;
  is_active: boolean;
}

export default function PuntoEditor({ punto }: { punto: Punto }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    name: punto.name,
    address: punto.address,
    notes: punto.notes ?? "",
    is_active: punto.is_active,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("delivery_locations")
      .update({
        name: form.name.trim(),
        address: form.address.trim(),
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      })
      .eq("id", punto.id);

    setGuardando(false);

    if (updateError) {
      setError("No se pudo guardar el punto de entrega.");
      return;
    }
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <div className="bg-white border border-peach rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{punto.name}</p>
          <p className="text-xs text-brown/50 truncate">{punto.notes || punto.address}</p>
        </div>
        <button onClick={() => setAbierto(true)} className={CHIP_OLIVE_OUTLINE}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="bg-white border border-peach rounded-xl p-4 flex flex-col gap-3">
      <Campo
        id={`name-${punto.id}`}
        etiqueta="Nombre"
        valor={form.name}
        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
      />
      <Campo
        id={`address-${punto.id}`}
        etiqueta="Dirección o referencia"
        valor={form.address}
        onChange={(v) => setForm((p) => ({ ...p, address: v }))}
      />
      <Campo
        id={`notes-${punto.id}`}
        etiqueta="Nota de entrega"
        ayuda="Ej. dejar en recepción, llamar al llegar"
        valor={form.notes}
        onChange={(v) => setForm((p) => ({ ...p, notes: v }))}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
        />
        Activo
        <span className="text-xs text-brown/50">
          — si lo desactivas, deja de aparecer al registrarse
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={CHIP_OLIVE}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={CHIP_OLIVE_OUTLINE}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold block mb-1">
        {etiqueta}
      </label>
      <input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-peach px-3 py-2"
      />
      {ayuda && <p className="text-xs text-brown/50 mt-1">{ayuda}</p>}
    </div>
  );
}
