import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMXN, formatWeekRangeLabel } from "@/lib/format";
import { BTN_PRIMARY, BTN_SECONDARY, TEXT_LINK } from "@/lib/ui";
import BarChart from "./BarChart";
import { requireAdmin } from "@/lib/auth";
import { esFalloDeConexion } from "@/lib/db-error";
import EstadoSinConexion from "@/app/EstadoSinConexion";

export const dynamic = "force-dynamic";

function startOfMonthISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AdminHomePage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: publishedMenu, error: publishedMenuError } = await supabase
    .from("menus")
    .select("id, week_start_date")
    .eq("is_published", true)
    .maybeSingle();

  // Este dashboard encadena más de diez consultas. Si Supabase no responde, todas
  // devuelven vacío y el panel mostraría "$0.00", "0 pedidos", "Ninguno" en cada
  // tarjeta — para el equipo, eso se lee como una caída real del negocio, no como un
  // problema técnico. Se corta aquí, con la primera consulta como representativa.
  if (esFalloDeConexion(publishedMenuError)) return <EstadoSinConexion contexto="admin" />;

  const { data: pendingOrders, count: pendingCount } = await supabase
    .from("orders")
    .select("id, customer_name, total, created_at", { count: "exact" })
    .in("payment_status", ["pending", "transfer_uploaded"])
    .order("created_at", { ascending: true })
    .limit(6);

  // Días de la semana publicada (para el rango de fechas y la gráfica por día)
  const { data: days } = publishedMenu
    ? await supabase
        .from("menu_days")
        .select("day_date, day_label, position")
        .eq("menu_id", publishedMenu.id)
        .order("position")
    : { data: [] };
  const weekRangeLabel = formatWeekRangeLabel((days ?? []).map((d) => d.day_date));

  // Pedidos confirmados y ventas confirmadas de la semana publicada
  const { data: weekOrders, count: weekConfirmedCount } = publishedMenu
    ? await supabase
        .from("orders")
        .select("total", { count: "exact" })
        .eq("menu_id", publishedMenu.id)
        .eq("payment_status", "confirmed")
    : { data: [], count: 0 };
  const weekConfirmedTotal = (weekOrders ?? []).reduce((s, o) => s + Number(o.total), 0);

  // Ventas / pedidos confirmados del mes
  const { data: monthConfirmedOrders } = await supabase
    .from("orders")
    .select("id, total")
    .eq("payment_status", "confirmed")
    .gte("created_at", startOfMonthISO());
  const monthConfirmedTotal = (monthConfirmedOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const monthConfirmedCount = (monthConfirmedOrders ?? []).length;

  // Platillos más pedidos del mes (todos los pedidos, no solo confirmados, para ver demanda real)
  const { data: monthOrders } = await supabase
    .from("orders")
    .select("id")
    .gte("created_at", startOfMonthISO());
  const monthOrderIds = (monthOrders ?? []).map((o) => o.id);
  const { data: monthItems } =
    monthOrderIds.length > 0
      ? await supabase.from("order_items").select("id, dish_name, quantity").in("order_id", monthOrderIds)
      : { data: [] };

  const dishCounts = new Map<string, number>();
  for (const item of monthItems ?? []) {
    dishCounts.set(item.dish_name, (dishCounts.get(item.dish_name) ?? 0) + item.quantity);
  }
  const topDishes = [...dishCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Ventas por día de la semana publicada
  let salesByDay: { label: string; value: number }[] = [];
  if (publishedMenu) {
    const dayDates = (days ?? []).map((d) => d.day_date);
    const { data: dayItems } =
      dayDates.length > 0
        ? await supabase.from("order_items").select("id, day_date, unit_price, quantity").in("day_date", dayDates)
        : { data: [] };

    const itemIds = (dayItems ?? []).map((i) => i.id);
    const { data: itemOptions } =
      itemIds.length > 0
        ? await supabase.from("order_item_options").select("order_item_id, extra_cost").in("order_item_id", itemIds)
        : { data: [] };

    const extraByItem = new Map<string, number>();
    for (const o of itemOptions ?? []) {
      extraByItem.set(o.order_item_id, (extraByItem.get(o.order_item_id) ?? 0) + Number(o.extra_cost));
    }

    const totalsByDate = new Map<string, number>();
    for (const item of dayItems ?? []) {
      const lineTotal = (Number(item.unit_price) + (extraByItem.get(item.id) ?? 0)) * item.quantity;
      totalsByDate.set(item.day_date, (totalsByDate.get(item.day_date) ?? 0) + lineTotal);
    }

    salesByDay = (days ?? []).map((d) => ({
      label: d.day_label.split(" ").slice(0, 2).join(" "),
      value: totalsByDate.get(d.day_date) ?? 0,
    }));
  }

  // Ventas por semana (últimas 8 semanas con menú)
  const { data: recentMenus } = await supabase
    .from("menus")
    .select("id, week_start_date")
    .order("week_start_date", { ascending: false })
    .limit(8);

  const recentMenuIds = (recentMenus ?? []).map((m) => m.id);
  const { data: allOrdersForWeeks } =
    recentMenuIds.length > 0
      ? await supabase.from("orders").select("menu_id, total").in("menu_id", recentMenuIds)
      : { data: [] };

  const totalsByMenu = new Map<string, number>();
  for (const o of allOrdersForWeeks ?? []) {
    if (!o.menu_id) continue;
    totalsByMenu.set(o.menu_id, (totalsByMenu.get(o.menu_id) ?? 0) + Number(o.total));
  }
  const salesByWeek = (recentMenus ?? [])
    .slice()
    .reverse()
    .map((m) => ({ label: m.week_start_date.slice(5), value: totalsByMenu.get(m.id) ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl text-olive-dark">Hola 👋</h1>
        <div className="flex gap-3">
          <Link href="/admin/pedidos" className={BTN_PRIMARY}>
            Ver pedidos
          </Link>
          <Link href="/admin/menu" className={BTN_SECONDARY}>
            Gestionar menú
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card label="Menú publicado" value={publishedMenu ? weekRangeLabel : "Ninguno"} />
        <Card label="Pedidos confirmados" value={String(weekConfirmedCount ?? 0)} />
        <Card label="Ventas de la semana" value={formatMXN(weekConfirmedTotal)} />
        <Card label="Ventas del mes" value={`${formatMXN(monthConfirmedTotal)} · ${monthConfirmedCount} pedidos`} />
      </div>

      {(pendingCount ?? 0) > 0 && (
        <div className="bg-white border border-peach rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Pedidos pendientes de confirmar ({pendingCount})</h2>
            <Link href="/admin/pedidos?status=pending" className={`text-sm ${TEXT_LINK}`}>
              Ver todos
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {(pendingOrders ?? []).map((order) => (
              <li key={order.id} className="flex items-center justify-between text-sm">
                <span>{order.customer_name}</span>
                <span className="font-semibold text-rust">{formatMXN(Number(order.total))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-peach rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Ventas por día (semana publicada)</h2>
          {publishedMenu ? (
            <BarChart data={salesByDay} />
          ) : (
            <p className="text-sm text-brown/40">No hay un menú publicado.</p>
          )}
        </div>

        <div className="bg-white border border-peach rounded-2xl p-4">
          <h2 className="font-semibold mb-3">Ventas por semana (últimas {salesByWeek.length})</h2>
          <BarChart data={salesByWeek} multiColor />
        </div>
      </div>

      <div className="bg-white border border-peach rounded-2xl p-4">
        <h2 className="font-semibold mb-3">Platillos más pedidos este mes</h2>
        {topDishes.length === 0 ? (
          <p className="text-sm text-brown/40">Aún no hay pedidos este mes.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {topDishes.map((dish, i) => (
              <li key={dish.name} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-brown/40 mr-2">#{i + 1}</span>
                  {dish.name}
                </span>
                <span className="font-semibold text-rust">{dish.count} porción(es)</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-2 border-dashed border-peach rounded-2xl p-8 flex items-center justify-center text-center text-brown/40 text-sm">
        Espacio reservado para fotos / carrusel próximamente
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-peach rounded-2xl p-4">
      <p className="text-sm text-brown/60">{label}</p>
      <p className="font-display text-xl text-olive-dark mt-1">{value}</p>
    </div>
  );
}
