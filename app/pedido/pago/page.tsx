import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { esFalloDeConexion } from "@/lib/db-error";
import EstadoSinConexion from "@/app/EstadoSinConexion";
import type { MetodoPago, TipoPago } from "@/lib/pagos";
import PagoForm from "./PagoForm";

export const dynamic = "force-dynamic";

const CLAVES_BANCO = ["bank_clabe", "bank_name", "bank_holder", "bank_reference_note"] as const;

export default async function PagoPage() {
  const usuario = await requireUser();
  const supabase = await createClient();

  const [{ data: metodos }, { data: ajustes }, { data: perfil, error: perfilError }] = await Promise.all([
    supabase
      .from("payment_methods")
      .select("id, type, label, is_default")
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase.from("settings").select("key, value").in("key", CLAVES_BANCO),
    supabase
      .from("profiles")
      .select("delivery_location_id, delivery_locations(name, address, notes)")
      .eq("id", usuario.id)
      .maybeSingle(),
  ]);

  // Sin esto, un fallo de conexión aquí se veía igual que "no has elegido tu punto de
  // entrega" —PagoForm ya maneja !punto mostrando ese mensaje— y en el paso donde se va
  // a cobrar dinero, esa confusión es la peor posible.
  if (esFalloDeConexion(perfilError)) return <EstadoSinConexion />;

  const banco: Record<string, string> = {};
  for (const fila of ajustes ?? []) banco[fila.key] = fila.value ?? "";

  const punto = perfil?.delivery_locations as unknown as
    | { name: string; address: string; notes: string | null }
    | null;

  return (
    <PagoForm
      userId={usuario.id}
      metodos={(metodos ?? []).map(
        (m): MetodoPago => ({
          id: m.id,
          type: m.type as TipoPago,
          label: m.label,
          isDefault: m.is_default,
        })
      )}
      banco={banco}
      punto={punto}
    />
  );
}
