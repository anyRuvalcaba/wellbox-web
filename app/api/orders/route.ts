import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOrderable } from "@/lib/cutoff";

interface OrderItemPayload {
  dayDate: string;
  dishId: string;
  quantity: number;
  selectedOptionIds: string[]; // option_choices ids
}

interface OrderPayload {
  menuId: string;
  customer: {
    name: string;
    phone: string;
    notes: string;
  };
  items: OrderItemPayload[];
  transferProofPath: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as OrderPayload;

  const supabase = await createClient();

  // La identidad sale de la sesión, nunca del body. Si el cliente pudiera mandar su
  // propio user_id, podría crear pedidos a nombre de otra persona. La política de
  // insert de `orders` exige user_id = auth.uid(), así que la base rechazaría el
  // intento de todas formas — esto solo devuelve un error entendible antes de llegar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Necesitas iniciar sesión para hacer un pedido." },
      { status: 401 }
    );
  }

  if (!body.customer?.name?.trim() || !body.customer?.phone?.trim()) {
    return NextResponse.json({ error: "Nombre y teléfono son obligatorios." }, { status: 400 });
  }
  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "El pedido no tiene platillos." }, { status: 400 });
  }

  const dishIds = body.items.map((i) => i.dishId);
  const { data: dishes, error: dishesError } = await supabase
    .from("dishes")
    .select("id, name, price, menu_day_id, menu_days(day_date, day_label, menu_id)")
    .in("id", dishIds);

  if (dishesError || !dishes) {
    return NextResponse.json({ error: "No se pudieron validar los platillos." }, { status: 500 });
  }

  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  const allChoiceIds = body.items.flatMap((i) => i.selectedOptionIds);
  const { data: choices, error: choicesError } =
    allChoiceIds.length > 0
      ? await supabase
          .from("option_choices")
          .select("id, label, extra_cost, option_group_id, option_groups(label, dish_id)")
          .in("id", allChoiceIds)
      : { data: [], error: null };

  if (choicesError) {
    return NextResponse.json({ error: "No se pudieron validar las opciones." }, { status: 500 });
  }
  const choiceMap = new Map((choices ?? []).map((c) => [c.id, c]));

  const now = new Date();
  let total = 0;
  const resolvedItems: {
    dishId: string;
    dishName: string;
    dayLabel: string;
    dayDate: string;
    unitPrice: number;
    quantity: number;
    options: { groupLabel: string; choiceLabel: string; extraCost: number }[];
  }[] = [];

  for (const item of body.items) {
    const dish = dishMap.get(item.dishId);
    const dayInfo = dish?.menu_days as { day_date: string; day_label: string; menu_id: string } | null;

    if (!dish || !dayInfo || dayInfo.menu_id !== body.menuId) {
      return NextResponse.json({ error: "Uno de los platillos ya no está disponible." }, { status: 400 });
    }
    if (!isOrderable(dayInfo.day_date, now)) {
      return NextResponse.json(
        { error: `El periodo para pedir el ${dayInfo.day_label} ya cerró.` },
        { status: 400 }
      );
    }

    const options = item.selectedOptionIds.map((choiceId) => {
      const choice = choiceMap.get(choiceId);
      const group = choice?.option_groups as { label: string; dish_id: string } | null;
      return {
        groupLabel: group?.label ?? "Opción",
        choiceLabel: choice?.label ?? "",
        extraCost: choice ? Number(choice.extra_cost) : 0,
      };
    });

    const unitPrice = Number(dish.price);
    const optionsTotal = options.reduce((s, o) => s + o.extraCost, 0);
    const quantity = Math.max(1, Math.floor(item.quantity) || 1);
    total += (unitPrice + optionsTotal) * quantity;

    resolvedItems.push({
      dishId: dish.id,
      dishName: dish.name,
      dayLabel: dayInfo.day_label,
      dayDate: dayInfo.day_date,
      unitPrice,
      quantity,
      options,
    });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: body.customer.name.trim(),
      customer_phone: body.customer.phone.trim(),
      delivery_type: "delivery",
      delivery_address: null,
      notes: body.customer.notes?.trim() || null,
      total,
      payment_status: body.transferProofPath ? "transfer_uploaded" : "pending",
      transfer_proof_url: body.transferProofPath || null,
      menu_id: body.menuId,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "No se pudo crear el pedido." }, { status: 500 });
  }

  for (const item of resolvedItems) {
    const { data: orderItem, error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        dish_id: item.dishId,
        dish_name: item.dishName,
        day_label: item.dayLabel,
        day_date: item.dayDate,
        unit_price: item.unitPrice,
        quantity: item.quantity,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      await supabase.rpc("delete_incomplete_order", { order_id: order.id });
      return NextResponse.json({ error: "No se pudo guardar el pedido." }, { status: 500 });
    }

    if (item.options.length > 0) {
      const { error: optionsError } = await supabase.from("order_item_options").insert(
        item.options.map((o) => ({
          order_item_id: orderItem.id,
          option_group_label: o.groupLabel,
          chosen_option_label: o.choiceLabel,
          extra_cost: o.extraCost,
        }))
      );
      if (optionsError) {
        await supabase.rpc("delete_incomplete_order", { order_id: order.id });
        return NextResponse.json({ error: "No se pudo guardar el pedido." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ orderId: order.id, total });
}
