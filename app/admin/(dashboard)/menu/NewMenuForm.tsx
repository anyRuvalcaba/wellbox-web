"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDaysISO } from "@/lib/date";
import { formatDayLabel } from "@/lib/format";
import { BTN_PRIMARY } from "@/lib/ui";

export default function NewMenuForm() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState("");
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weekStart) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: menu, error: menuError } = await supabase
      .from("menus")
      .insert({ week_start_date: weekStart })
      .select("id")
      .single();

    if (menuError || !menu) {
      setError("No se pudo crear la semana.");
      setSubmitting(false);
      return;
    }

    const dayCount = includeSaturday ? 6 : 5;
    const days = Array.from({ length: dayCount }, (_, i) => {
      const dayDate = addDaysISO(weekStart, i);
      return {
        menu_id: menu.id,
        day_date: dayDate,
        day_label: formatDayLabel(dayDate),
        position: i,
      };
    });

    const { error: daysError } = await supabase.from("menu_days").insert(days);
    if (daysError) {
      setError("No se pudieron crear los días.");
      setSubmitting(false);
      return;
    }

    router.push(`/admin/menu/${menu.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-peach rounded-2xl p-4 flex flex-col gap-3">
      <h2 className="font-semibold">Crear nueva semana</h2>
      <div>
        <label className="text-sm font-semibold block mb-1">Lunes de inicio</label>
        <input
          type="date"
          required
          className="rounded-lg border border-peach px-3 py-2"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeSaturday}
          onChange={(e) => setIncludeSaturday(e.target.checked)}
        />
        Incluir sábado (de lo contrario, Lunes a Viernes)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className={`self-start ${BTN_PRIMARY}`}>
        {submitting ? "Creando..." : "Crear semana"}
      </button>
    </form>
  );
}
