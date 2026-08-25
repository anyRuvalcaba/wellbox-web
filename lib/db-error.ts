// Se verificó antes de escribir esto, no se asumió: supabase-js NO lanza excepciones
// cuando la conexión falla. Contra un puerto sin nada escuchando, devuelve:
//   { data: null, error: { message: "TypeError: fetch failed", code: "" } }
// — la misma forma que una consulta válida sin resultados. Sin esta distinción, "la
// base está caída" y "no hay nada que mostrar" se ven exactamente igual.
//
// No hay un código de error estándar de Postgres para "no pude ni preguntar", así que
// esto es una heurística sobre el mensaje, no una certeza. Cubre el patrón verificado
// (fetch failed) y las variantes de red más comunes en Node (conexión rechazada,
// tiempo agotado, DNS). Un falso negativo aquí solo hace que el mensaje sea el
// genérico en vez del específico — no hay downside de seguridad.
export function esFalloDeConexion(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const mensaje = (error.message ?? "").toLowerCase();
  return (
    mensaje.includes("fetch failed") ||
    mensaje.includes("econnrefused") ||
    mensaje.includes("econnreset") ||
    mensaje.includes("etimedout") ||
    mensaje.includes("enotfound")
  );
}

export const MENSAJE_SIN_CONEXION =
  "Estamos teniendo problemas para conectarnos. Intenta de nuevo en un momento.";
