"use client";

import { useEffect } from "react";
import { BTN_PRIMARY } from "@/lib/ui";

// Mismo propósito que app/pedido/error.tsx, pero el equipo puede ver más detalle
// técnico: es información útil para decidir si vale la pena reintentar o avisar.
export default function ErrorAdmin({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="py-12 flex flex-col items-start gap-3 max-w-lg">
      <h1 className="font-display text-2xl text-olive-dark">Algo salió mal</h1>
      <p className="text-brown/70">Esta pantalla no se pudo cargar.</p>
      {error.digest && (
        <p className="text-xs text-brown/40 font-mono">Referencia: {error.digest}</p>
      )}
      <button onClick={() => unstable_retry()} className={BTN_PRIMARY}>
        Intentar de nuevo
      </button>
    </div>
  );
}
