import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { esFalloDeConexion } from "@/lib/db-error";
import EstadoSinConexion from "@/app/EstadoSinConexion";
import RoleSelect from "./RoleSelect";
import PuntoSelect from "./PuntoSelect";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  // Se repite aquí y no solo en el layout: los layouts no se re-renderizan al navegar.
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: usuarios, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, delivery_location_id, created_at")
    .order("created_at", { ascending: false });

  // Los puntos activos se cargan una sola vez y se pasan a cada fila, en vez de que
  // cada selector haga su propia consulta.
  const { data: puntos } = await supabase
    .from("delivery_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("position");

  if (esFalloDeConexion(error)) return <EstadoSinConexion contexto="admin" />;

  if (error) {
    return (
      <p className="text-sm text-red-600">
        No se pudo cargar la lista de usuarios. Vuelve a intentar en un momento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl text-olive-dark">Usuarios</h1>
        <p className="text-sm text-brown/60 mt-1">
          {usuarios?.length ?? 0} registrados. Solo un administrador puede cambiar roles y
          puntos de entrega.
        </p>
      </div>

      {/* La tabla scrollea sola en pantallas chicas en vez de romper el layout */}
      <div className="overflow-x-auto border border-peach rounded-2xl bg-white">
        <table className="w-full text-sm min-w-[48rem]">
          <thead className="bg-cream-dark/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">Teléfono</th>
              <th className="px-4 py-3 font-semibold">Punto de entrega</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios?.map((usuario) => (
              <tr key={usuario.id} className="border-t border-peach/60">
                <td className="px-4 py-3">{usuario.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-brown/70">{usuario.email ?? "—"}</td>
                <td className="px-4 py-3 text-brown/70">{usuario.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <PuntoSelect
                    userId={usuario.id}
                    puntoActual={usuario.delivery_location_id}
                    puntos={puntos ?? []}
                  />
                </td>
                <td className="px-4 py-3">
                  <RoleSelect
                    userId={usuario.id}
                    role={usuario.role === "admin" ? "admin" : "customer"}
                    // Quitarse el rol a uno mismo deja el panel sin quien lo administre.
                    esCuentaPropia={usuario.id === admin.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {usuarios?.length === 0 && (
        <p className="text-sm text-brown/60">Todavía no hay usuarios registrados.</p>
      )}
    </div>
  );
}
