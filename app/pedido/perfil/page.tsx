import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { MetodoPago, TipoPago } from "@/lib/pagos";
import PerfilForm from "./PerfilForm";
import MetodosPago from "./MetodosPago";
import SelectorPunto from "./SelectorPunto";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const usuario = await requireUser();
  const supabase = await createClient();

  const [{ data: perfil }, { data: metodos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, delivery_location_id, delivery_locations(name, address, notes)")
      .eq("id", usuario.id)
      .single(),
    // Sin filtrar por usuario: la política de payment_methods ya limita a los propios.
    // Filtrar aquí también escondería un error si esa política se rompiera.
    supabase
      .from("payment_methods")
      .select("id, type, label, is_default")
      .order("is_default", { ascending: false })
      .order("created_at"),
  ]);

  const punto = perfil?.delivery_locations as unknown as
    | { name: string; address: string; notes: string | null }
    | null;

  const metodosNormalizados: MetodoPago[] = (metodos ?? []).map((m) => ({
    id: m.id,
    type: m.type as TipoPago,
    label: m.label,
    isDefault: m.is_default,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark text-center">Mi perfil</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-olive-dark">Mis datos</h2>
        <PerfilForm
          userId={usuario.id}
          nombreInicial={perfil?.full_name ?? ""}
          telefonoInicial={perfil?.phone ?? ""}
        />
        <p className="text-xs text-brown/50">Tu correo es {usuario.email}.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-olive-dark">Mi punto de entrega</h2>
        <div className="bg-white border border-peach rounded-xl p-4">
          {punto ? (
            <>
              <p className="font-semibold">{punto.name}</p>
              <p className="text-sm text-brown/60">{punto.address}</p>
              {punto.notes && <p className="text-sm text-brown/60 mt-1">{punto.notes}</p>}
            </>
          ) : (
            <SelectorPunto userId={usuario.id} />
          )}
          {/* Se explica por qué no hay botón de editar: si no, parece que falta algo. */}
          {punto && (
            <p className="text-xs text-brown/50 mt-3">
              Tu punto de entrega queda fijo porque es tu lugar de trabajo. Si cambiaste
              de sede, escríbenos y lo ajustamos.
            </p>
          )}
        </div>
      </section>

      <MetodosPago userId={usuario.id} metodos={metodosNormalizados} />
    </div>
  );
}
