import { createClient } from "@/lib/supabase/server";
import { esFalloDeConexion } from "@/lib/db-error";
import type { MenuDay, MenuDish, OptionGroup, PublishedMenu } from "@/lib/types";
import MenuBrowser from "./MenuBrowser";
import EstadoSinConexion from "@/app/EstadoSinConexion";

export const dynamic = "force-dynamic";

// null en `menu` puede significar dos cosas muy distintas: no hay semana publicada
// (vacío legítimo), o Supabase no respondió (falla técnica). `sinConexion` distingue
// la segunda, revisando solo esta primera consulta — es la más temprana y la más
// representativa: si la base no responde aquí, no va a responder en las siguientes.
async function getPublishedMenu(): Promise<{
  menu: PublishedMenu | null;
  sinConexion: boolean;
}> {
  const supabase = await createClient();

  const { data: menu, error: menuError } = await supabase
    .from("menus")
    .select("id, week_start_date")
    .eq("is_published", true)
    .maybeSingle();

  if (esFalloDeConexion(menuError)) return { menu: null, sinConexion: true };
  if (!menu) return { menu: null, sinConexion: false };

  const { data: days } = await supabase
    .from("menu_days")
    .select("id, day_date, day_label, position")
    .eq("menu_id", menu.id)
    .order("position");

  if (!days || days.length === 0) {
    return { menu: { id: menu.id, weekStartDate: menu.week_start_date, days: [] }, sinConexion: false };
  }

  const dayIds = days.map((d) => d.id);

  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, menu_day_id, name, description, price, photo_url, position, stock")
    .in("menu_day_id", dayIds)
    .order("position");

  const dishIds = (dishes ?? []).map((d) => d.id);

  // Sin límite (stock nulo) no aparece en la vista con un valor — solo si tiene tope.
  // Se lee aparte, no en el mismo select, porque dish_availability es una vista
  // distinta con su propio cálculo.
  const { data: disponibilidad } = await supabase
    .from("dish_availability")
    .select("dish_id, disponible")
    .in("dish_id", dishIds.length > 0 ? dishIds : ["00000000-0000-0000-0000-000000000000"]);

  const disponibleByDish = new Map(
    (disponibilidad ?? []).map((d) => [d.dish_id, d.disponible])
  );

  const { data: groups } = await supabase
    .from("option_groups")
    .select("id, dish_id, label, type, is_required, position")
    .in("dish_id", dishIds.length > 0 ? dishIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position");

  const groupIds = (groups ?? []).map((g) => g.id);

  const { data: choices } = await supabase
    .from("option_choices")
    .select("id, option_group_id, label, extra_cost, position")
    .in("option_group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position");

  const groupsByDish = new Map<string, OptionGroup[]>();
  for (const group of groups ?? []) {
    const groupChoices = (choices ?? [])
      .filter((c) => c.option_group_id === group.id)
      .map((c) => ({ id: c.id, label: c.label, extraCost: Number(c.extra_cost) }));

    const entry: OptionGroup = {
      id: group.id,
      label: group.label,
      type: group.type as "single" | "multiple",
      isRequired: group.is_required,
      choices: groupChoices,
    };
    const list = groupsByDish.get(group.dish_id) ?? [];
    list.push(entry);
    groupsByDish.set(group.dish_id, list);
  }

  const dishesByDay = new Map<string, MenuDish[]>();
  for (const dish of dishes ?? []) {
    const entry: MenuDish = {
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: Number(dish.price),
      photoUrl: dish.photo_url,
      optionGroups: groupsByDish.get(dish.id) ?? [],
      // dish.stock null → sin tope → available null, sin ir a buscarlo en la vista.
      available: dish.stock === null ? null : (disponibleByDish.get(dish.id) ?? 0),
      stock: dish.stock,
    };
    const list = dishesByDay.get(dish.menu_day_id) ?? [];
    list.push(entry);
    dishesByDay.set(dish.menu_day_id, list);
  }

  const menuDays: MenuDay[] = days.map((day) => ({
    id: day.id,
    dayDate: day.day_date,
    dayLabel: day.day_label,
    dishes: dishesByDay.get(day.id) ?? [],
  }));

  return { menu: { id: menu.id, weekStartDate: menu.week_start_date, days: menuDays }, sinConexion: false };
}

export default async function PedidoPage() {
  const { menu, sinConexion } = await getPublishedMenu();

  if (sinConexion) return <EstadoSinConexion />;

  if (!menu || menu.days.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="font-display text-3xl text-olive-dark mb-2">Por ahora no hay menú disponible</h1>
        <p className="text-brown/70">Vuelve a checar pronto, estamos preparando la próxima semana.</p>
      </div>
    );
  }

  return <MenuBrowser menu={menu} />;
}
