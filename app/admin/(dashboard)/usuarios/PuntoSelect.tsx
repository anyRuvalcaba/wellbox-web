"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// El permiso para esto ya existía desde T-001: la política "update own profile or admin
// updates all" deja al admin escribir cualquier perfil. Lo que faltaba era la pantalla.
// El registro le promete a la clienta que si cambia de sede se lo ajustamos, y hasta
// ahora esa promesa solo se podía cumplir entrando al editor SQL de Supabase.
export default function PuntoSelect({
  userId,
  puntoActual,
  puntos,
}: {
  userId: string;
  puntoActual: string | null;
  puntos: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [valor, setValor] = useState(puntoActual ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  async function cambiarPunto(nuevo: string) {
    const anterior = valor;
    setValor(nuevo);
    setGuardando(true);
    setError(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      // Cadena vacía significa "sin punto asignado", y en la base eso es null, no "".
      .update({ delivery_location_id: nuevo === "" ? null : nuevo })
      .eq("id", userId);

    setGuardando(false);

    if (updateError) {
      // Mismo criterio que RoleSelect: revertir lo que se ve para que la pantalla no
      // mienta sobre lo que quedó guardado.
      setValor(anterior);
      setError(true);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Punto de entrega del usuario"
        value={valor}
        disabled={guardando}
        onChange={(e) => cambiarPunto(e.target.value)}
        className="rounded-lg border border-peach px-2 py-1.5 text-sm bg-white disabled:opacity-50 max-w-[14rem]"
      >
        <option value="">Sin asignar</option>
        {puntos.map((punto) => (
          <option key={punto.id} value={punto.id}>
            {punto.name}
          </option>
        ))}
      </select>
      {guardando && <span className="text-xs text-brown/50">Guardando...</span>}
      {error && <span className="text-xs text-red-600">No se pudo cambiar</span>}
    </div>
  );
}
