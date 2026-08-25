import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// ⚠️ Cliente con la llave de servicio: SALTA TODAS LAS POLÍTICAS RLS.
//
// Solo debe usarse en código que corre sin sesión de usuario y que necesita escribir de
// todas formas — hoy únicamente el webhook de Stripe, que llega desde el servidor de
// Stripe y no trae cookies de nadie.
//
// La llave no lleva prefijo NEXT_PUBLIC_, así que Next impide que este archivo se
// importe desde un componente cliente. Si alguna vez el build falla al importarlo, es
// esa protección funcionando: la solución no es renombrar la variable.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llaveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !llaveServicio) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Está en Supabase → Project Settings → API."
    );
  }

  return createSupabaseClient<Database>(url, llaveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
