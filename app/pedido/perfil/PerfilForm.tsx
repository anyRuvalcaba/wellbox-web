"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY } from "@/lib/ui";

export default function PerfilForm({
  userId,
  nombreInicial,
  telefonoInicial,
}: {
  userId: string;
  nombreInicial: string;
  telefonoInicial: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);

    const supabase = createClient();
    // El rol y el punto de entrega no se mandan aquí. Aunque se mandaran, los triggers
    // de la base los revertirían: la clienta no puede cambiarlos.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: nombre.trim() || null, phone: telefono.trim() || null })
      .eq("id", userId);

    setGuardando(false);

    if (updateError) {
      setError("No se pudieron guardar tus datos.");
      return;
    }

    setGuardado(true);
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="bg-white border border-peach rounded-xl p-4 flex flex-col gap-3">
      <div>
        <label htmlFor="nombre" className="text-sm font-semibold block mb-1">
          Nombre completo
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          className="w-full rounded-lg border border-peach px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="telefono" className="text-sm font-semibold block mb-1">
          Teléfono
        </label>
        <input
          id="telefono"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-lg border border-peach px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {guardado && <p className="text-sm text-olive-dark">Datos guardados.</p>}

      <button type="submit" disabled={guardando} className={BTN_PRIMARY}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
