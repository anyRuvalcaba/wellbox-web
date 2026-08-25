"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/format";
import { BTN_SECONDARY, CHIP_OLIVE, CHIP_OLIVE_OUTLINE } from "@/lib/ui";

interface PlatilloPrevio {
  id: string;
  name: string;
  price: number;
  grupos: number;
  dayDate: string;
}

export default function ReuseDishPicker({
  menuDayId,
  dayLabel,
  menuIdActual,
}: {
  menuDayId: string;
  dayLabel: string;
  menuIdActual: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [platillos, setPlatillos] = useState<PlatilloPrevio[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [copiando, setCopiando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || platillos) return;

    const supabase = createClient();
    supabase
      .from("dishes")
      .select("id, name, price, menu_days!inner(day_date, menu_id), option_groups(id)")
      .then(({ data, error: consultaError }) => {
        if (consultaError || !data) {
          setError("No se pudo cargar el historial de platillos.");
          setPlatillos([]);
          return;
        }

        const filas = data
          .map((d) => {
            const dia = d.menu_days as unknown as { day_date: string; menu_id: string };
            return {
              id: d.id,
              name: d.name,
              price: Number(d.price),
              grupos: (d.option_groups as unknown as { id: string }[]).length,
              dayDate: dia.day_date,
              menuId: dia.menu_id,
            };
          })
          // La semana que se está editando no aporta nada al historial.
          .filter((d) => d.menuId !== menuIdActual)
          .sort((a, b) => b.dayDate.localeCompare(a.dayDate));

        // Un mismo platillo aparece muchas veces a lo largo del año. Se queda la
        // versión más reciente, que es la que tiene el precio y las opciones vigentes.
        const porNombre = new Map<string, PlatilloPrevio>();
        for (const fila of filas) {
          if (!porNombre.has(fila.name)) porNombre.set(fila.name, fila);
        }
        setPlatillos([...porNombre.values()]);
      });
  }, [abierto, platillos, menuIdActual]);

  async function copiar(dishId: string) {
    setCopiando(dishId);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("clone_dish_into_day", {
      source_dish_id: dishId,
      target_menu_day_id: menuDayId,
    });

    setCopiando(null);

    if (rpcError) {
      setError("No se pudo copiar el platillo.");
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={CHIP_OLIVE_OUTLINE}>
        ↻ Traer de otra semana
      </button>
    );
  }

  const visibles = (platillos ?? []).filter((p) =>
    p.name.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-brown/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-cream w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <header className="px-4 py-3 border-b border-peach">
          <h2 className="font-display text-xl text-olive-dark">Traer un platillo</h2>
          <p className="text-xs text-brown/60">
            Se copia a {dayLabel} con sus grupos de opciones. Después lo puedes editar.
          </p>
        </header>

        <div className="px-4 py-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-lg border border-peach px-3 py-2 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2">
          {platillos === null && <p className="text-sm text-brown/50 py-4">Cargando...</p>}

          {platillos !== null && visibles.length === 0 && (
            <p className="text-sm text-brown/50 py-4">
              {platillos.length === 0
                ? "Todavía no hay platillos de semanas anteriores."
                : "Ningún platillo coincide con esa búsqueda."}
            </p>
          )}

          {visibles.map((platillo) => (
            <div
              key={platillo.id}
              className="flex items-center justify-between gap-3 bg-white border border-peach/60 rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{platillo.name}</p>
                <p className="text-xs text-brown/50">
                  {formatMXN(platillo.price)}
                  {platillo.grupos > 0 && ` · ${platillo.grupos} grupo(s) de opciones`}
                </p>
              </div>
              <button
                onClick={() => copiar(platillo.id)}
                disabled={copiando !== null}
                className={CHIP_OLIVE}
              >
                {copiando === platillo.id ? "Copiando..." : "Copiar"}
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 px-4 pt-2">{error}</p>}

        <footer className="px-4 py-3 border-t border-peach">
          <button onClick={() => setAbierto(false)} className={`${BTN_SECONDARY} w-full`}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  );
}
