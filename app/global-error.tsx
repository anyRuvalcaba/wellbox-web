"use client";

// Red final: si algo truena en el layout raíz mismo, ni app/pedido/error.tsx ni
// app/admin/error.tsx lo alcanzan a cubrir — ellos envuelven sus propios segmentos,
// no el layout que está por encima de ambos. Por eso global-error define su propio
// <html>/<body>: reemplaza al layout raíz por completo mientras está activo.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h1>Algo salió mal</h1>
          <p>Intenta de nuevo en un momento.</p>
          <button onClick={() => unstable_retry()}>Intentar de nuevo</button>
        </div>
      </body>
    </html>
  );
}
