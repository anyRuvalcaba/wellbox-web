import { createClient } from "@/lib/supabase/server";
import { formatWeekRangeLabel } from "@/lib/format";
import WeekSelector from "./WeekSelector";
import StatusFilter from "./StatusFilter";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface OrderRow {
  id: string;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  total: number;
  paymentStatus: string;
  proofSignedUrl: string | null;
  createdAt: string;
  items: {
    dishName: string;
    dayLabel: string;
    dayDate: string;
    unitPrice: number;
    quantity: number;
    options: { groupLabel: string; choiceLabel: string }[];
  }[];
}

import OrdersTable from "./OrdersTable";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ menu?: string; status?: string }>;
}) {
  await requireAdmin();
  const { menu: menuParam, status: statusParam } = await searchParams;
  const selectedStatus = statusParam === "pending" || statusParam === "confirmed" ? statusParam : "all";
  const supabase = await createClient();

  const { data: allMenus } = await supabase
    .from("menus")
    .select("id, week_start_date, is_published")
    .order("week_start_date", { ascending: false });

  const menus = allMenus ?? [];
  const publishedMenu = menus.find((m) => m.is_published);
  const defaultMenuId = publishedMenu?.id ?? menus[0]?.id ?? "all";
  const selectedMenuId = menuParam && (menuParam === "all" || menus.some((m) => m.id === menuParam))
    ? menuParam
    : defaultMenuId;

  const allMenuIds = menus.map((m) => m.id);
  const { data: allMenuDays } =
    allMenuIds.length > 0
      ? await supabase.from("menu_days").select("menu_id, day_date").in("menu_id", allMenuIds)
      : { data: [] };
  const dayDatesByMenu = new Map<string, string[]>();
  for (const day of allMenuDays ?? []) {
    const list = dayDatesByMenu.get(day.menu_id) ?? [];
    list.push(day.day_date);
    dayDatesByMenu.set(day.menu_id, list);
  }

  let menuDays: { dayDate: string; dayLabel: string }[] = [];
  if (selectedMenuId !== "all") {
    const { data: days } = await supabase
      .from("menu_days")
      .select("day_date, day_label, position")
      .eq("menu_id", selectedMenuId)
      .order("position");
    menuDays = (days ?? []).map((d) => ({ dayDate: d.day_date, dayLabel: d.day_label }));
  }

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, notes, total, payment_status, transfer_proof_url, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (selectedMenuId !== "all") {
    ordersQuery = ordersQuery.eq("menu_id", selectedMenuId);
  }

  const { data: orders } = await ordersQuery;

  const orderIds = (orders ?? []).map((o) => o.id);

  const { data: items } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select("id, order_id, dish_name, day_label, day_date, unit_price, quantity")
          .in("order_id", orderIds)
      : { data: [] };

  const itemIds = (items ?? []).map((i) => i.id);

  const { data: options } =
    itemIds.length > 0
      ? await supabase
          .from("order_item_options")
          .select("order_item_id, option_group_label, chosen_option_label")
          .in("order_item_id", itemIds)
      : { data: [] };

  const optionsByItem = new Map<string, { groupLabel: string; choiceLabel: string }[]>();
  for (const opt of options ?? []) {
    const list = optionsByItem.get(opt.order_item_id) ?? [];
    list.push({ groupLabel: opt.option_group_label, choiceLabel: opt.chosen_option_label });
    optionsByItem.set(opt.order_item_id, list);
  }

  const itemsByOrder = new Map<string, OrderRow["items"]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      dishName: item.dish_name,
      dayLabel: item.day_label,
      dayDate: item.day_date,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      options: optionsByItem.get(item.id) ?? [],
    });
    itemsByOrder.set(item.order_id, list);
  }

  const rows: OrderRow[] = await Promise.all(
    (orders ?? []).map(async (order) => {
      let proofSignedUrl: string | null = null;
      if (order.transfer_proof_url) {
        const { data } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(order.transfer_proof_url, 3600);
        proofSignedUrl = data?.signedUrl ?? null;
      }
      return {
        id: order.id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        notes: order.notes,
        total: Number(order.total),
        paymentStatus: order.payment_status,
        proofSignedUrl,
        createdAt: order.created_at,
        items: itemsByOrder.get(order.id) ?? [],
      };
    })
  );

  // Lista de compras por día: siempre usa todos los pedidos de la semana,
  // sin importar el filtro de estatus (se necesita comprar/preparar para todos).
  // Solo el agregado platillo × cantidad — el detalle de quién pidió qué con
  // qué opciones vive en la tabla de pedidos de abajo (una sola fuente de verdad).
  const dishCountsByDay = new Map<string, Map<string, number>>();
  if (selectedMenuId !== "all") {
    for (const order of rows) {
      for (const item of order.items) {
        const dishCounts = dishCountsByDay.get(item.dayDate) ?? new Map<string, number>();
        dishCounts.set(item.dishName, (dishCounts.get(item.dishName) ?? 0) + item.quantity);
        dishCountsByDay.set(item.dayDate, dishCounts);
      }
    }
  }

  const tableRows =
    selectedStatus === "all"
      ? rows
      : selectedStatus === "pending"
        ? rows.filter((o) => o.paymentStatus !== "confirmed")
        : rows.filter((o) => o.paymentStatus === "confirmed");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl text-olive-dark">Pedidos</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusFilter selected={selectedStatus} />
          <WeekSelector
            menus={menus.map((m) => ({
              id: m.id,
              label: formatWeekRangeLabel(dayDatesByMenu.get(m.id) ?? []) || `Semana del ${m.week_start_date}`,
              isPublished: m.is_published,
            }))}
            selected={selectedMenuId}
          />
        </div>
      </div>

      {selectedMenuId !== "all" && menuDays.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuDays.map((day) => {
            const dishCounts = [...(dishCountsByDay.get(day.dayDate)?.entries() ?? [])];
            return (
              <div key={day.dayDate} className="bg-white border border-peach rounded-2xl p-4">
                <h3 className="font-semibold mb-2">{day.dayLabel}</h3>
                {dishCounts.length === 0 ? (
                  <p className="text-sm text-brown/40">Sin pedidos.</p>
                ) : (
                  <ul className="text-sm flex flex-col gap-1">
                    {dishCounts.map(([name, count]) => (
                      <li key={name} className="flex justify-between">
                        <span>{name}</span>
                        <span className="font-semibold text-rust">×{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <OrdersTable orders={tableRows} />
    </div>
  );
}
