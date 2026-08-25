import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MenuDay, MenuDish, OptionGroup } from "@/lib/types";
import MenuEditor from "./MenuEditor";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MenuEditorPage({
  params,
}: {
  params: Promise<{ menuId: string }>;
}) {
  await requireAdmin();
  const { menuId } = await params;
  const supabase = await createClient();

  const { data: menu } = await supabase
    .from("menus")
    .select("id, week_start_date, is_published")
    .eq("id", menuId)
    .maybeSingle();

  if (!menu) notFound();

  const { data: days } = await supabase
    .from("menu_days")
    .select("id, day_date, day_label, position")
    .eq("menu_id", menuId)
    .order("position");

  const dayIds = (days ?? []).map((d) => d.id);

  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, menu_day_id, name, description, price, photo_url, position, stock")
    .in("menu_day_id", dayIds.length > 0 ? dayIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position");

  const dishIds = (dishes ?? []).map((d) => d.id);

  // Aquí "available" se usa para mostrarle al equipo cuántas quedan por vender, no para
  // bloquear nada — el admin siempre puede editar. El tope que se edita en el formulario
  // es dish.stock, que se pasa aparte al draft.
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
      available: dish.stock === null ? null : (disponibleByDish.get(dish.id) ?? 0),
      stock: dish.stock,
      optionGroups: groupsByDish.get(dish.id) ?? [],
    };
    const list = dishesByDay.get(dish.menu_day_id) ?? [];
    list.push(entry);
    dishesByDay.set(dish.menu_day_id, list);
  }

  const menuDays: MenuDay[] = (days ?? []).map((day) => ({
    id: day.id,
    dayDate: day.day_date,
    dayLabel: day.day_label,
    dishes: dishesByDay.get(day.id) ?? [],
  }));

  return (
    <MenuEditor
      menu={{ id: menu.id, weekStartDate: menu.week_start_date, isPublished: menu.is_published, days: menuDays }}
    />
  );
}
