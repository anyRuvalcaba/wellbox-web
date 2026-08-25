"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BTN_SECONDARY, TEXT_LINK } from "@/lib/ui";

export default function DuplicateWeekForm({
  semanas,
}: {
  semanas: { id: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState(semanas[0]?.id ?? "");
  const [inicio, setInicio] = useState("");
  const [conSabado, setConSabado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (semanas.length === 0) return null;

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={TEXT_LINK}>
        ↻ Duplicar una semana anterior
      </button>
    );
  }

  async function duplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!origen || !inicio) return;
    setTrabajando(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("duplicate_menu_week", {
      source_menu_id: origen,
      new_week_start: inicio,
      include_saturday: conSabado,
    });

    if (rpcError || !data) {
      setError("No se pudo duplicar la semana. Revisa que la fecha no choque con otra.");
      setTrabajando(false);
      return;
    }

    // La copia nace como borrador: se abre el editor para ajustarla antes de publicar.
    router.push(`/admin/menu/${data}`);
  }

  return (
    <form
      onSubmit={duplicar}
      className="bg-white border border-peach rounded-2xl p-4 flex flex-col gap-3"
    >
      <h2 className="font-semibold">Duplicar una semana</h2>
      <p className="text-xs text-brown/60">
        Copia los platillos con sus grupos de opciones y recorre las fechas. La copia
        queda como borrador, sin publicar.
      </p>

      <div>
        <label htmlFor="origen" className="text-sm font-semibold block mb-1">
          ¿Cuál semana quieres copiar?
        </label>
        <select
          id="origen"
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
        >
          {semanas.map((semana) => (
            <option key={semana.id} value={semana.id}>
              {semana.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="inicio" className="text-sm font-semibold block mb-1">
          Lunes de la semana nueva
        </label>
        <input
          id="inicio"
          type="date"
          required
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="w-full rounded-lg border border-peach px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={conSabado} onChange={(e) => setConSabado(e.target.checked)} />
        Incluir sábado
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={trabajando} className={`${BTN_SECONDARY} flex-1`}>
          {trabajando ? "Duplicando..." : "Duplicar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={BTN_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
