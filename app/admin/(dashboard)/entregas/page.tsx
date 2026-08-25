import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formatMXN, formatWeekRangeLabel } from "@/lib/format";
import PuntoEditor from "./PuntoEditor";

export const dynamic = "force-dynamic";

export default async function EntregasPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: puntos } = await supabase
    .from("delivery_locations")
    .select("id, name, address, notes, is_active, position")
    .order("position");

  // Clientas asociadas a cada punto.
  const { data: perfiles } = await supabase
    .from("profiles")
    .select("delivery_location_id")
    .not("delivery_location_id", "is", null);

  // Entregas de la semana publicada: es la que se está operando.
  const { data: menuPublicado } = await supabase
    .from("menus")
    .select("id")
    .eq("is_published", true)
    .maybeSingle();

  const { data: dias } = menuPublicado
    ? await supabase.from("menu_days").select("day_date").eq("menu_id", menuPublicado.id)
    : { data: [] };

  const { data: pedidos } = menuPublicado
    ? await supabase
        .from("orders")
        .select("delivery_location_id, total")
        .eq("menu_id", menuPublicado.id)
    : { data: [] };

  const clientasPorPunto = new Map<string, number>();
  for (const perfil of perfiles ?? []) {
    const id = perfil.delivery_location_id!;
    clientasPorPunto.set(id, (clientasPorPunto.get(id) ?? 0) + 1);
  }

  const pedidosPorPunto = new Map<string, { cantidad: number; total: number }>();
  for (const pedido of pedidos ?? []) {
    if (!pedido.delivery_location_id) continue;
    const actual = pedidosPorPunto.get(pedido.delivery_location_id) ?? { cantidad: 0, total: 0 };
    pedidosPorPunto.set(pedido.delivery_location_id, {
      cantidad: actual.cantidad + 1,
      total: actual.total + Number(pedido.total),
    });
  }

  const sinPunto = (pedidos ?? []).filter((p) => !p.delivery_location_id).length;
  const etiquetaSemana = formatWeekRangeLabel((dias ?? []).map((d) => d.day_date));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-olive-dark">Puntos de entrega</h1>
        <p className="text-sm text-brown/60 mt-1">
          {menuPublicado
            ? `Pedidos de la semana ${etiquetaSemana || "publicada"}.`
            : "No hay una semana publicada, así que no hay pedidos que contar."}
        </p>
      </div>

      <div className="overflow-x-auto border border-peach rounded-2xl bg-white">
        <table className="w-full text-sm min-w-[34rem]">
          <thead className="bg-cream-dark/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Punto</th>
              <th className="px-4 py-3 font-semibold text-right">Clientas</th>
              <th className="px-4 py-3 font-semibold text-right">Entregas</th>
              <th className="px-4 py-3 font-semibold text-right">Vendido</th>
            </tr>
          </thead>
          <tbody>
            {(puntos ?? []).map((punto) => {
              const pedidosDelPunto = pedidosPorPunto.get(punto.id);
              return (
                <tr key={punto.id} className="border-t border-peach/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{punto.name}</p>
                    <p className="text-xs text-brown/50">{punto.address}</p>
                    {!punto.is_active && (
                      <span className="text-xs text-rust font-semibold">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{clientasPorPunto.get(punto.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {pedidosDelPunto?.cantidad ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-brown/70">
                    {formatMXN(pedidosDelPunto?.total ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sinPunto > 0 && (
        <p className="text-sm text-brown/60">
          {sinPunto} pedido(s) de esta semana no tienen punto de entrega: son anteriores a
          que existieran los puntos.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-olive-dark">Editar puntos</h2>
        {(puntos ?? []).map((punto) => (
          <PuntoEditor key={punto.id} punto={punto} />
        ))}
      </section>
    </div>
  );
}
