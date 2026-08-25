"use client";

import { useEffect } from "react";
import { BTN_PRIMARY } from "@/lib/ui";

// Red de seguridad para errores de programación de verdad (una excepción sin capturar,
// un undefined.algo) — no para que Supabase esté caído, que ya se maneja como valor de
// retorno en cada página (ver lib/db-error.ts). Es la distinción que la propia guía de
// Next 16 hace: errores esperados → valores de retorno; excepciones no capturadas →
// límites de error como este.
export default function ErrorPedido({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[pedido]", error);
  }, [error]);

  return (
    <div className="text-center py-16 flex flex-col items-center gap-4">
      <p className="text-3xl">😕</p>
      <h1 className="font-display text-2xl text-olive-dark">Algo salió mal</h1>
      <p className="text-brown/70 max-w-sm">
        No se pudo cargar esta pantalla. No perdiste tu pedido — intenta de nuevo.
      </p>
      {/* unstable_retry, no reset: en Next 16 reset limpia el estado sin volver a pedir
          los datos; retry los vuelve a pedir y renderiza de nuevo. La causa más probable
          aquí es una conexión que ya se recuperó, así que retry es lo que corresponde. */}
      <button onClick={() => unstable_retry()} className={BTN_PRIMARY}>
        Intentar de nuevo
      </button>
    </div>
  );
}
