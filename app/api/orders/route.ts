import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOrderable } from "@/lib/cutoff";
import { aCentavos, MONEDA, stripe } from "@/lib/stripe/server";

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
  // Para efectivo y transferencia es el id de payment_methods. Para tarjeta llega la
  // cadena "card": las tarjetas ya no viven en esta base, las administra Stripe.
  paymentMethodId: string;
  transferProofPath: string;
}

const PAGO_CON_TARJETA = "card";

// Mismo criterio que lib/pagos.ts, pero del lado del servidor: la etiqueta que se
// guarda en el pedido no puede depender de lo que mande el cliente.
function etiquetaMetodo(metodo: { type: string; label: string | null }): string {
  if (metodo.label?.trim()) return metodo.label.trim();
  return metodo.type === "cash" ? "Efectivo" : "Transferencia";
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
  if (!body.paymentMethodId) {
    return NextResponse.json({ error: "Elige una forma de pago." }, { status: 400 });
  }

  const conTarjeta = body.paymentMethodId === PAGO_CON_TARJETA;

  // No se filtra por user_id a propósito: la política de payment_methods ya limita la
  // lectura a los propios. Si el id fuera de otra persona, esto devuelve vacío.
  const { data: metodo } = conTarjeta
    ? { data: null }
    : await supabase
        .from("payment_methods")
        .select("id, type, label")
        .eq("id", body.paymentMethodId)
        .maybeSingle();

  if (!conTarjeta && !metodo) {
    return NextResponse.json({ error: "Esa forma de pago no está disponible." }, { status: 400 });
  }

  // El comprobante solo tiene sentido si se paga por transferencia.
  if (metodo?.type === "transfer" && !body.transferProofPath) {
    return NextResponse.json(
      { error: "Sube tu comprobante de transferencia." },
      { status: 400 }
    );
  }

  // El punto de entrega sale del perfil, no del cliente: es un dato que la clienta no
  // puede cambiar por su cuenta, así que tampoco debería poder mandarlo en el pedido.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("delivery_location_id, delivery_locations(name)")
    .eq("id", user.id)
    .maybeSingle();

  const punto = perfil?.delivery_locations as unknown as { name: string } | null;

  if (!perfil?.delivery_location_id || !punto) {
    return NextResponse.json(
      { error: "Antes de pedir, elige tu punto de entrega en tu perfil." },
      { status: 400 }
    );
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

  // Con tarjeta, el cobro se crea antes que el pedido para poder guardar su id en el
  // mismo INSERT. Todavía no se cobra nada: un PaymentIntent recién creado solo reserva
  // la intención, y si el pedido no llega a crearse expira solo sin consecuencias.
  let intentoTarjeta: Awaited<ReturnType<typeof stripe.paymentIntents.create>> | null = null;

  if (conTarjeta) {
    try {
      const clienteStripe = await obtenerClienteStripe(supabase, user.id, user.email);
      intentoTarjeta = await stripe.paymentIntents.create({
        // El importe sale del total calculado arriba contra la base, nunca del cliente.
        amount: aCentavos(total),
        currency: MONEDA,
        customer: clienteStripe,
        automatic_payment_methods: { enabled: true },
        metadata: { wellbox_user_id: user.id },
      });
    } catch {
      return NextResponse.json(
        { error: "No pudimos iniciar el cobro. Intenta de nuevo en un momento." },
        { status: 503 }
      );
    }
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
      // Con tarjeta nace 'pending' y solo pasa a 'paid' cuando el servidor le pregunta
      // a Stripe si el cobro ocurrió. Nunca por lo que diga el navegador.
      payment_status:
        metodo?.type === "transfer" && body.transferProofPath ? "transfer_uploaded" : "pending",
      transfer_proof_url: body.transferProofPath || null,
      menu_id: body.menuId,
      user_id: user.id,
      delivery_location_id: perfil.delivery_location_id,
      // Copias, no solo referencias: si un admin mueve a la clienta de punto o ella
      // borra la tarjeta, este pedido debe seguir diciendo dónde se entregó y cómo se
      // pagó realmente.
      delivery_location_name: punto.name,
      payment_method_id: metodo?.id ?? null,
      payment_method_label: metodo ? etiquetaMetodo(metodo) : "Tarjeta",
      stripe_payment_intent_id: intentoTarjeta?.id ?? null,
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

  // ── Cobro con tarjeta ───────────────────────────────────────────────────
  //
  // El pedido ya existe en 'pending'. Si el cobro falla o la clienta abandona, queda un
  // pedido sin pagar — visible y reconciliable. El orden inverso (cobrar y luego crear)
  // tiene una falla peor: si la creación fallara, quedaría cobrada sin pedido y sin
  // registro de qué compró.
  if (conTarjeta) {
    try {
      const clienteStripe = await obtenerClienteStripe(supabase, user.id, user.email);

      // El PaymentIntent se crea DESPUÉS del pedido, pero su id se guarda con un
      // update... que la sesión de la clienta no puede hacer: la política de `orders`
      // solo permite actualizar a un admin. Por eso el id se escribe en el INSERT, y
      // para eso el intento tiene que existir antes. Ver el bloque de arriba.
      const sesionCliente = await stripe.customerSessions.create({
        customer: clienteStripe,
        components: {
          payment_element: {
            enabled: true,
            features: {
              payment_method_redisplay: "enabled",
              payment_method_save: "enabled",
              payment_method_save_usage: "off_session",
              payment_method_remove: "enabled",
            },
          },
        },
      });

      // El id del pedido ya existe, así que se puede dejar en los metadata del intento:
      // es lo que el webhook usa para saber qué pedido marcar.
      await stripe.paymentIntents.update(intentoTarjeta!.id, {
        metadata: { order_id: order.id, wellbox_user_id: user.id },
      });

      return NextResponse.json({
        orderId: order.id,
        total,
        requierePago: true,
        clientSecret: intentoTarjeta!.client_secret,
        customerSessionClientSecret: sesionCliente.client_secret,
      });
    } catch {
      return NextResponse.json(
        { error: "No pudimos iniciar el cobro. Intenta de nuevo en un momento." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ orderId: order.id, total });
}

// Cada clienta necesita un Customer en Stripe para que sus tarjetas guardadas sean
// suyas y de nadie más. Se crea la primera vez que paga con tarjeta y se reutiliza.
async function obtenerClienteStripe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined
): Promise<string> {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (perfil?.stripe_customer_id) return perfil.stripe_customer_id;

  const cliente = await stripe.customers.create({
    email,
    name: perfil?.full_name ?? undefined,
    metadata: { wellbox_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: cliente.id })
    .eq("id", userId);

  return cliente.id;
}
