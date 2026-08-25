"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useCart } from "./cart-context";
import { isOrderable, nextUpcomingCutoff } from "@/lib/cutoff";
import { formatDayLabel, formatMXN } from "@/lib/format";
import type { CartItem, CartSelectedOption, MenuDish, PublishedMenu } from "@/lib/types";
import { CHIP_DANGER, CHIP_OLIVE, CHIP_OLIVE_OUTLINE } from "@/lib/ui";
import QuantityStepper from "./QuantityStepper";

// El reloj del navegador es un sistema externo a React, y useSyncExternalStore es el
// primitivo hecho para eso. Lo importante aquí es el tercer argumento: el *snapshot del
// servidor*, que devuelve null.
//
// Antes esto era un useState inicializado con `new Date()`, y provocaba un error de
// hidratación: el servidor renderizaba "145h 21m 54s" y el navegador, un segundo después,
// "145h 21m 53s". React ve dos textos distintos, da el árbol por inconsistente y lo
// vuelve a generar completo — tirando de paso el estado de esa rama.
//
// Con null en el servidor, el contador simplemente no se dibuja hasta que hay navegador,
// que es la única parte donde un reloj al segundo tiene sentido.
//
// El snapshot devuelve segundos y no un Date: getSnapshot debe devolver un valor estable
// entre llamadas, y `new Date()` sería un objeto nuevo cada vez — bucle infinito.
function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    (alCambiar) => {
      const id = setInterval(alCambiar, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 1000),
    () => null
  );
}

function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "0h 0m 0s";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function MenuBrowser({ menu }: { menu: PublishedMenu }) {
  const cart = useCart();
  const now = useNow();

  useEffect(() => {
    cart.setMenuId(menu.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu.id]);

  // Para decidir qué días siguen abiertos basta la fecha aproximada: los cierres son a
  // las 11pm, así que un segundo de diferencia no cambia el resultado. Lo que sí no
  // puede renderizarse en el servidor es el contador al segundo, que es donde estaba el
  // problema de hidratación.
  const ahoraParaCortes = useMemo(
    () => (now !== null ? new Date(now * 1000) : new Date()),
    [now]
  );
  const nextCutoff = useMemo(
    () => nextUpcomingCutoff(menu.days.map((d) => d.dayDate), ahoraParaCortes),
    [menu.days, ahoraParaCortes]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="font-display text-3xl text-olive-dark">Menú de la semana</h1>
        <p className="text-brown/70 text-sm mt-1">Entrega a las 10am. Elige tu platillo por día.</p>
      </div>

      {nextCutoff && now && (
        <div className="bg-peach-light border border-peach rounded-xl px-4 py-2 text-center text-sm">
          <span className="font-semibold text-rust">Cierra el próximo pedido en </span>
          <span className="font-semibold text-brown">{formatCountdown(nextCutoff, ahoraParaCortes)}</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {menu.days.map((day) => (
          <DayCard key={day.id} dayDate={day.dayDate} dayLabel={day.dayLabel} dishes={day.dishes} now={ahoraParaCortes} />
        ))}
      </div>

      <CartBar />
    </div>
  );
}

function DayCard({
  dayDate,
  dayLabel,
  dishes,
  now,
}: {
  dayDate: string;
  dayLabel: string;
  dishes: MenuDish[];
  now: Date;
}) {
  const cart = useCart();
  const orderable = isOrderable(dayDate, now);
  const selected = cart.items.find((i) => i.dayDate === dayDate) ?? null;
  const [expandedDishId, setExpandedDishId] = useState<string | null>(null);

  if (dishes.length === 0) return null;

  return (
    <section
      className={`rounded-2xl border p-4 ${
        orderable ? "bg-white/60 border-peach" : "bg-cream-dark border-cream-dark"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl text-olive-dark">{formatDayLabel(dayDate) || dayLabel}</h2>
        {!orderable && (
          <span className="text-xs font-semibold text-brown/50 bg-cream px-2 py-1 rounded-full">
            No disponible — pedidos cerrados
          </span>
        )}
      </div>

      {!orderable ? (
        <p className="text-sm text-brown/40">El periodo para pedir este día ya cerró (11pm del día anterior).</p>
      ) : (
        <div className="flex flex-col gap-3">
          {dishes.map((dish) => (
            <DishOption
              key={dish.id}
              dish={dish}
              dayDate={dayDate}
              dayLabel={dayLabel}
              selectedItem={selected?.dishId === dish.id ? selected : null}
              isExpanded={expandedDishId === dish.id}
              onExpand={() => setExpandedDishId(dish.id)}
              onCollapse={() => setExpandedDishId(null)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DishOption({
  dish,
  dayDate,
  dayLabel,
  selectedItem,
  isExpanded,
  onExpand,
  onCollapse,
}: {
  dish: MenuDish;
  dayDate: string;
  dayLabel: string;
  selectedItem: CartItem | null;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const cart = useCart();
  const isSelected = selectedItem !== null;
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);

  // null = sin límite. 0 = agotado. Un número bajo se avisa de una vez, para que la
  // clienta no arme sus opciones y se entere hasta el final que ya no hay.
  const agotado = dish.available === 0;
  const pocasQuedan = dish.available !== null && dish.available > 0 && dish.available <= 3;

  function handleTap() {
    if (agotado && !isSelected) return;
    if (isSelected) {
      if (dish.optionGroups.length === 0) {
        // nada que editar, un toque quita el platillo
        cart.removeDayItem(dayDate);
        onCollapse();
        return;
      }
      // reabre el panel con la selección actual para poder cambiarla
      const prefill: Record<string, Set<string>> = {};
      for (const opt of selectedItem?.selectedOptions ?? []) {
        const set = prefill[opt.groupId] ?? new Set<string>();
        set.add(opt.choiceId);
        prefill[opt.groupId] = set;
      }
      setDraft(prefill);
      setError(null);
      onExpand();
      return;
    }
    if (dish.optionGroups.length === 0) {
      cart.setDayItem(dayDate, {
        dayDate,
        dayLabel,
        dishId: dish.id,
        dishName: dish.name,
        unitPrice: dish.price,
        quantity: 1,
        selectedOptions: [],
      });
      return;
    }
    setDraft({});
    setError(null);
    onExpand();
  }

  function handleRemove() {
    cart.removeDayItem(dayDate);
    onCollapse();
  }

  function toggleChoice(group: MenuDish["optionGroups"][number], choiceId: string) {
    setDraft((prev) => {
      const current = new Set(prev[group.id] ?? []);
      if (group.type === "single") {
        return { ...prev, [group.id]: new Set([choiceId]) };
      }
      if (current.has(choiceId)) current.delete(choiceId);
      else current.add(choiceId);
      return { ...prev, [group.id]: current };
    });
  }

  function confirmSelection() {
    for (const group of dish.optionGroups) {
      const picked = draft[group.id];
      if (group.isRequired && (!picked || picked.size === 0)) {
        setError(`Falta elegir: ${group.label}`);
        return;
      }
    }
    const selectedOptions: CartSelectedOption[] = [];
    for (const group of dish.optionGroups) {
      const picked = draft[group.id];
      if (!picked) continue;
      for (const choiceId of picked) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (!choice) continue;
        selectedOptions.push({
          groupId: group.id,
          groupLabel: group.label,
          choiceId: choice.id,
          choiceLabel: choice.label,
          extraCost: choice.extraCost,
        });
      }
    }
    cart.setDayItem(dayDate, {
      dayDate,
      dayLabel,
      dishId: dish.id,
      dishName: dish.name,
      unitPrice: dish.price,
      quantity: selectedItem?.quantity ?? 1,
      selectedOptions,
    });
    onCollapse();
  }

  return (
    <div
      className={`rounded-xl border transition ${
        isSelected
          ? "border-olive bg-olive-light/20"
          : agotado
            ? "border-peach/40 bg-cream-dark/30"
            : "border-peach/70 bg-white"
      }`}
    >
      <div className="w-full px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={handleTap}
            disabled={agotado && !isSelected}
            className="flex-1 text-left flex items-start gap-3 disabled:cursor-not-allowed"
          >
            <div className={`flex-1 ${agotado && !isSelected ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{dish.name}</p>
                {isSelected && <span className="text-olive text-sm">✓ Agregado</span>}
                {agotado && !isSelected && (
                  <span className="text-xs font-semibold text-rust bg-peach-light px-2 py-0.5 rounded-full">
                    Agotado
                  </span>
                )}
                {pocasQuedan && (
                  <span className="text-xs font-semibold text-rust">
                    ¡Quedan {dish.available}!
                  </span>
                )}
              </div>
              {dish.description && <p className="text-sm text-brown/60 mt-0.5">{dish.description}</p>}
              {isSelected && dish.optionGroups.length > 0 && (
                <p className="text-xs text-olive mt-1">Toca para cambiar tu selección</p>
              )}
            </div>
            <p className="font-semibold text-rust whitespace-nowrap">{formatMXN(dish.price)}</p>
          </button>
          {isSelected && (
            <button type="button" onClick={handleRemove} className={CHIP_DANGER}>
              Quitar
            </button>
          )}
        </div>
        {isSelected && selectedItem && (
          <div className="flex items-center justify-between pl-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-brown/60">Cantidad</span>
              <QuantityStepper
                quantity={selectedItem.quantity}
                onChange={(q) => cart.setItemQuantity(dayDate, q)}
                max={dish.available ?? undefined}
              />
            </div>
            <span className="text-xs text-brown/50">
              Subtotal:{" "}
              {formatMXN(
                (selectedItem.unitPrice +
                  selectedItem.selectedOptions.reduce((s, o) => s + o.extraCost, 0)) *
                  selectedItem.quantity
              )}
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-peach/50 pt-3">
          {dish.optionGroups.map((group) => (
            <div key={group.id}>
              <p className="text-sm font-semibold mb-1.5">
                {group.label} {group.isRequired && <span className="text-rust">*</span>}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.choices.map((choice) => {
                  const checked = draft[group.id]?.has(choice.id) ?? false;
                  return (
                    <label key={choice.id} className="flex items-center gap-2 text-sm">
                      <input
                        type={group.type === "single" ? "radio" : "checkbox"}
                        name={group.id}
                        checked={checked}
                        onChange={() => toggleChoice(group, choice.id)}
                      />
                      <span>{choice.label}</span>
                      {choice.extraCost > 0 && (
                        <span className="text-brown/50">+{formatMXN(choice.extraCost)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirmSelection} className={CHIP_OLIVE}>
              {isSelected ? "Guardar cambios" : "Agregar al pedido"}
            </button>
            <button type="button" onClick={onCollapse} className={CHIP_OLIVE_OUTLINE}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartBar() {
  const cart = useCart();
  if (cart.items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-olive-dark text-cream px-4 py-3 flex items-center justify-between shadow-lg">
      <div>
        <p className="text-xs opacity-80">{cart.items.length} día(s) seleccionado(s)</p>
        <p className="font-semibold">{formatMXN(cart.total)}</p>
      </div>
      <Link href="/pedido/resumen" className="bg-cream text-olive-dark font-semibold rounded-full px-5 py-2.5">
        Continuar
      </Link>
    </div>
  );
}
