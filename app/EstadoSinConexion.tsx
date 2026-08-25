import { MENSAJE_SIN_CONEXION } from "@/lib/db-error";

// Se usa en ambos lados —/pedido y /admin— cuando una página detecta que Supabase no
// respondió, para no confundir "la base está caída" con "no hay nada que mostrar".
// El tono cambia según quién lo ve: la clienta necesita tranquilidad, el equipo
// necesita poder actuar.
export default function EstadoSinConexion({
  contexto = "cliente",
}: {
  contexto?: "cliente" | "admin";
}) {
  if (contexto === "admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
        <p className="font-semibold">No se pudo conectar con la base de datos.</p>
        <p className="mt-1">
          Espera un momento y recarga la página. Si sigue igual, revisa el estado de
          Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-16 flex flex-col items-center gap-3">
      <p className="text-3xl">📡</p>
      <p className="text-brown/80 font-semibold">{MENSAJE_SIN_CONEXION}</p>
      <p className="text-sm text-brown/50">No perdiste nada de tu pedido.</p>
    </div>
  );
}
