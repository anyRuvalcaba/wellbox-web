import { createClient } from "@/lib/supabase/server";
import type { MenuDay, MenuDish, OptionGroup, PublishedMenu } from "@/lib/types";
import MenuBrowser from "./MenuBrowser";

export const dynamic = "force-dynamic";

async function getPublishedMenu(): Promise<PublishedMenu | null> {
  const supabase = await createClient();

  const { data: menu } = await supabase
    .from("menus")
    .select("id, week_start_date")
    .eq("is_published", true)
    .maybeSingle();

  if (!menu) return null;

  const { data: days } = await supabase
    .from("menu_days")
    .select("id, day_date, day_label, position")
    .eq("menu_id", menu.id)
    .order("position");

  if (!days || days.length === 0) {
    return { id: menu.id, weekStartDate: menu.week_start_date, days: [] };
  }

  const dayIds = days.map((d) => d.id);

  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, menu_day_id, name, description, price, photo_url, position")
    .in("menu_day_id", dayIds)
    .order("position");

  const dishIds = (dishes ?? []).map((d) => d.id);

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

  return { id: menu.id, weekStartDate: menu.week_start_date, days: menuDays };
}

export default async function PedidoPage() {
  const menu = await getPublishedMenu();

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
