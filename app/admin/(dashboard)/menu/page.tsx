import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWeekRangeLabel } from "@/lib/format";
import { TEXT_LINK } from "@/lib/ui";
import NewMenuForm from "./NewMenuForm";
import PublishButton from "./PublishButton";
import DeleteMenuButton from "./DeleteMenuButton";
import DuplicateWeekForm from "./DuplicateWeekForm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MenuListPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: menus } = await supabase
    .from("menus")
    .select("id, week_start_date, is_published")
    .order("week_start_date", { ascending: false });

  const menuIds = (menus ?? []).map((m) => m.id);
  const { data: days } =
    menuIds.length > 0
      ? await supabase.from("menu_days").select("menu_id, day_date").in("menu_id", menuIds)
      : { data: [] };

  const dayDatesByMenu = new Map<string, string[]>();
  for (const day of days ?? []) {
    const list = dayDatesByMenu.get(day.menu_id) ?? [];
    list.push(day.day_date);
    dayDatesByMenu.set(day.menu_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark">Menú semanal</h1>

      <NewMenuForm />

      <DuplicateWeekForm
        semanas={(menus ?? []).map((menu) => ({
          id: menu.id,
          etiqueta:
            formatWeekRangeLabel(dayDatesByMenu.get(menu.id) ?? []) ||
            `Semana del ${menu.week_start_date}`,
        }))}
      />

      <div className="flex flex-col gap-2">
        {(menus ?? []).map((menu) => {
          const rangeLabel = formatWeekRangeLabel(dayDatesByMenu.get(menu.id) ?? []);
          return (
            <div
              key={menu.id}
              className="bg-white border border-peach rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <Link href={`/admin/menu/${menu.id}`} className={TEXT_LINK}>
                {rangeLabel || `Semana del ${menu.week_start_date}`}
              </Link>
              <div className="flex items-center gap-2">
                <PublishButton menuId={menu.id} isPublished={menu.is_published} />
                <DeleteMenuButton menuId={menu.id} weekStartDate={rangeLabel || menu.week_start_date} />
              </div>
            </div>
          );
        })}
        {(menus ?? []).length === 0 && (
          <p className="text-brown/50 text-sm">Aún no hay semanas creadas.</p>
        )}
      </div>
    </div>
  );
}
