"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RoleSelect({
  userId,
  role,
  esCuentaPropia,
}: {
  userId: string;
  role: "customer" | "admin";
  esCuentaPropia: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(role);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  // Sin esto, quitarse el rol a uno mismo dejaría el panel sin administrador y sin
  // forma de recuperarlo desde la app: habría que entrar al editor SQL de Supabase.
  if (esCuentaPropia) {
    return (
      <span className="text-xs font-semibold text-olive-dark bg-cream-dark/60 rounded-full px-3 py-1.5 whitespace-nowrap">
        Administrador (tú)
      </span>
    );
  }

  async function cambiarRol(nuevo: "customer" | "admin") {
    const anterior = valor;
    setValor(nuevo);
    setGuardando(true);
    setError(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: nuevo })
      .eq("id", userId);

    setGuardando(false);

    if (updateError) {
      // Revierte lo que se ve, para no dejar la pantalla mintiendo sobre el estado real.
      setValor(anterior);
      setError(true);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Rol del usuario"
        value={valor}
        disabled={guardando}
        onChange={(e) => cambiarRol(e.target.value as "customer" | "admin")}
        className="rounded-lg border border-peach px-2 py-1.5 text-sm bg-white disabled:opacity-50"
      >
        <option value="customer">Cliente</option>
        <option value="admin">Administrador</option>
      </select>
      {guardando && <span className="text-xs text-brown/50">Guardando...</span>}
      {error && <span className="text-xs text-red-600">No se pudo cambiar</span>}
    </div>
  );
}
