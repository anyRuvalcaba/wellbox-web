"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY } from "@/lib/ui";

// Se muestra solo cuando la clienta todavía no tiene punto asignado. Pasa con las
// cuentas creadas antes de que existieran los puntos, y con quien se registre cuando la
// confirmación por correo esté activada — ahí el alta no deja sesión para escribirlo.
//
// La base permite fijarlo cuando está vacío, pero no cambiarlo después.
export default function SelectorPunto({ userId }: { userId: string }) {
  const router = useRouter();
  const [puntos, setPuntos] = useState<{ id: string; name: string; address: string }[]>([]);
  const [elegido, setElegido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("delivery_locations")
      .select("id, name, address")
      .order("position")
      .then(({ data }) => setPuntos(data ?? []));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegido) return;
    setGuardando(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ delivery_location_id: elegido })
      .eq("id", userId);

    setGuardando(false);

    if (updateError) {
      setError("No se pudo guardar tu punto de entrega.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3">
      <p className="text-sm text-brown/70">
        Elige dónde recibes tus pedidos. Queda fijo, así que revísalo antes de guardar.
      </p>

      <select
        aria-label="Punto de entrega"
        value={elegido}
        onChange={(e) => setElegido(e.target.value)}
        className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
      >
        <option value="">Elige tu punto de entrega...</option>
        {puntos.map((punto) => (
          <option key={punto.id} value={punto.id}>
            {punto.name}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={!elegido || guardando} className={BTN_PRIMARY}>
        {guardando ? "Guardando..." : "Guardar punto de entrega"}
      </button>
    </form>
  );
}
