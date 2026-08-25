"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatMXN, formatWeekRangeLabel } from "@/lib/format";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_DANGER, CHIP_OLIVE_OUTLINE } from "@/lib/ui";
import PublishButton from "../PublishButton";
import DeleteMenuButton from "../DeleteMenuButton";
import ReuseDishPicker from "./ReuseDishPicker";
import type { MenuDay, MenuDish } from "@/lib/types";

interface DraftGroup {
  label: string;
  type: "single" | "multiple";
  isRequired: boolean;
  choices: { label: string; extraCost: string }[];
}

interface DishDraft {
  id?: string;
  menuDayId: string;
  name: string;
  description: string;
  price: string;
  photoUrl: string | null;
  photoFile: File | null;
  optionGroups: DraftGroup[];
}

function dishToDraft(dish: MenuDish | null, menuDayId: string): DishDraft {
  if (!dish) {
    return {
      menuDayId,
      name: "",
      description: "",
      price: "",
      photoUrl: null,
      photoFile: null,
      optionGroups: [],
    };
  }
  return {
    id: dish.id,
    menuDayId,
    name: dish.name,
    description: dish.description ?? "",
    price: String(dish.price),
    photoUrl: dish.photoUrl,
    photoFile: null,
    optionGroups: dish.optionGroups.map((g) => ({
      label: g.label,
      type: g.type,
      isRequired: g.isRequired,
      choices: g.choices.map((c) => ({ label: c.label, extraCost: String(c.extraCost) })),
    })),
  };
}

export default function MenuEditor({
  menu,
}: {
  menu: { id: string; weekStartDate: string; isPublished: boolean; days: MenuDay[] };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DishDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rangeLabel = formatWeekRangeLabel(menu.days.map((d) => d.dayDate)) || `Semana del ${menu.weekStartDate}`;

  async function handleDelete(dishId: string) {
    if (!confirm("¿Eliminar este platillo?")) return;
    const supabase = createClient();
    await supabase.from("dishes").delete().eq("id", dishId);
    router.refresh();
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.price) {
      setError("Nombre y precio son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    let dishId = editing.id;

    if (dishId) {
      const { error: updateError } = await supabase
        .from("dishes")
        .update({
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          price: Number(editing.price),
        })
        .eq("id", dishId);
      if (updateError) {
        setError("No se pudo guardar el platillo.");
        setSaving(false);
        return;
      }
    } else {
      const day = menu.days.find((d) => d.id === editing.menuDayId);
      const { data: inserted, error: insertError } = await supabase
        .from("dishes")
        .insert({
          menu_day_id: editing.menuDayId,
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          price: Number(editing.price),
          position: day?.dishes.length ?? 0,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        setError("No se pudo crear el platillo.");
        setSaving(false);
        return;
      }
      dishId = inserted.id;
    }

    if (editing.photoFile && dishId) {
      const ext = editing.photoFile.name.split(".").pop() || "jpg";
      const path = `${dishId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("dish-photos")
        .upload(path, editing.photoFile, { upsert: true });
      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from("dish-photos").getPublicUrl(path);
        await supabase.from("dishes").update({ photo_url: publicUrl.publicUrl }).eq("id", dishId);
      }
    }

    if (dishId) {
      await supabase.from("option_groups").delete().eq("dish_id", dishId);

      for (let gi = 0; gi < editing.optionGroups.length; gi++) {
        const group = editing.optionGroups[gi];
        if (!group.label.trim()) continue;
        const { data: insertedGroup, error: groupError } = await supabase
          .from("option_groups")
          .insert({
            dish_id: dishId,
            label: group.label.trim(),
            type: group.type,
            is_required: group.isRequired,
            position: gi,
          })
          .select("id")
          .single();
        if (groupError || !insertedGroup) continue;

        const choiceRows = group.choices
          .filter((c) => c.label.trim())
          .map((c, ci) => ({
            option_group_id: insertedGroup.id,
            label: c.label.trim(),
            extra_cost: Number(c.extraCost) || 0,
            position: ci,
          }));
        if (choiceRows.length > 0) {
          await supabase.from("option_choices").insert(choiceRows);
        }
      }
    }

    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-olive-dark">{rangeLabel}</h1>
        <div className="flex items-center gap-2">
          <PublishButton menuId={menu.id} isPublished={menu.isPublished} />
          <DeleteMenuButton menuId={menu.id} weekStartDate={rangeLabel} redirectTo="/admin/menu" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {menu.days.map((day) => (
          <section key={day.id} className="bg-white border border-peach rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{day.dayLabel}</h2>
              {day.dishes.length < 3 && (
                <div className="flex gap-2 flex-wrap justify-end">
                  <ReuseDishPicker
                    menuDayId={day.id}
                    dayLabel={day.dayLabel}
                    menuIdActual={menu.id}
                  />
                  <button onClick={() => setEditing(dishToDraft(null, day.id))} className={CHIP_OLIVE_OUTLINE}>
                    + Agregar platillo
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {day.dishes.map((dish) => (
                <div
                  key={dish.id}
                  className="flex items-center justify-between border border-peach/60 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {dish.photoUrl && (
                      <Image
                        src={dish.photoUrl}
                        alt={dish.name}
                        width={40}
                        height={40}
                        className="rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{dish.name}</p>
                      <p className="text-xs text-brown/50">
                        {formatMXN(dish.price)} · {dish.optionGroups.length} grupo(s) de opciones
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(dishToDraft(dish, day.id))} className={CHIP_OLIVE_OUTLINE}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(dish.id)} className={CHIP_DANGER}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {day.dishes.length === 0 && <p className="text-sm text-brown/40">Sin platillos.</p>}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <DishFormModal
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

function DishFormModal({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}: {
  draft: DishDraft;
  onChange: (d: DishDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  function updateGroup(index: number, patch: Partial<DraftGroup>) {
    const groups = [...draft.optionGroups];
    groups[index] = { ...groups[index], ...patch };
    onChange({ ...draft, optionGroups: groups });
  }

  function addGroup() {
    onChange({
      ...draft,
      optionGroups: [...draft.optionGroups, { label: "", type: "single", isRequired: false, choices: [] }],
    });
  }

  function removeGroup(index: number) {
    onChange({ ...draft, optionGroups: draft.optionGroups.filter((_, i) => i !== index) });
  }

  function addChoice(groupIndex: number) {
    const groups = [...draft.optionGroups];
    groups[groupIndex] = {
      ...groups[groupIndex],
      choices: [...groups[groupIndex].choices, { label: "", extraCost: "0" }],
    };
    onChange({ ...draft, optionGroups: groups });
  }

  function updateChoice(groupIndex: number, choiceIndex: number, patch: Partial<{ label: string; extraCost: string }>) {
    const groups = [...draft.optionGroups];
    const choices = [...groups[groupIndex].choices];
    choices[choiceIndex] = { ...choices[choiceIndex], ...patch };
    groups[groupIndex] = { ...groups[groupIndex], choices };
    onChange({ ...draft, optionGroups: groups });
  }

  function removeChoice(groupIndex: number, choiceIndex: number) {
    const groups = [...draft.optionGroups];
    groups[groupIndex] = {
      ...groups[groupIndex],
      choices: groups[groupIndex].choices.filter((_, i) => i !== choiceIndex),
    };
    onChange({ ...draft, optionGroups: groups });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-xl w-full my-8 flex flex-col gap-4">
        <h2 className="font-display text-2xl text-olive-dark">{draft.id ? "Editar platillo" : "Nuevo platillo"}</h2>

        <div>
          <label className="text-sm font-semibold block mb-1">Nombre</label>
          <input
            className="w-full rounded-lg border border-peach px-3 py-2"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">Descripción</label>
          <textarea
            className="w-full rounded-lg border border-peach px-3 py-2"
            rows={2}
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">Precio (MXN)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-peach px-3 py-2"
            value={draft.price}
            onChange={(e) => onChange({ ...draft, price: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">Foto</label>
          {draft.photoUrl && !draft.photoFile && (
            <Image src={draft.photoUrl} alt="" width={64} height={64} className="rounded-lg mb-2 object-cover" />
          )}
          <label className="flex items-center gap-2 border-2 border-dashed border-peach rounded-xl px-3 py-2 cursor-pointer text-sm hover:bg-peach-light/40 w-fit">
            <span>📷</span>
            <span className="font-semibold text-olive-dark">
              {draft.photoFile ? draft.photoFile.name : "Subir foto"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onChange({ ...draft, photoFile: e.target.files?.[0] ?? null })}
              className="hidden"
            />
          </label>
        </div>

        <div className="border-t border-peach pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Grupos de opciones</h3>
            <button onClick={addGroup} className={CHIP_OLIVE_OUTLINE}>
              + Agregar grupo
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {draft.optionGroups.map((group, gi) => (
              <div key={gi} className="border border-peach/60 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <input
                    placeholder="Ej. ¿Qué queso prefieres?"
                    className="flex-1 rounded-lg border border-peach px-2 py-1 text-sm"
                    value={group.label}
                    onChange={(e) => updateGroup(gi, { label: e.target.value })}
                  />
                  <select
                    className="rounded-lg border border-peach px-2 py-1 text-sm"
                    value={group.type}
                    onChange={(e) => updateGroup(gi, { type: e.target.value as "single" | "multiple" })}
                  >
                    <option value="single">Selección única</option>
                    <option value="multiple">Selección múltiple</option>
                  </select>
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={group.isRequired}
                      onChange={(e) => updateGroup(gi, { isRequired: e.target.checked })}
                    />
                    Obligatorio
                  </label>
                  <button
                    onClick={() => removeGroup(gi)}
                    aria-label="Eliminar grupo"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-col gap-1 pl-2">
                  {group.choices.map((choice, ci) => (
                    <div key={ci} className="flex gap-2 items-center">
                      <input
                        placeholder="Opción"
                        className="flex-1 rounded-lg border border-peach px-2 py-1 text-sm"
                        value={choice.label}
                        onChange={(e) => updateChoice(gi, ci, { label: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Costo extra"
                        className="w-24 rounded-lg border border-peach px-2 py-1 text-sm"
                        value={choice.extraCost}
                        onChange={(e) => updateChoice(gi, ci, { extraCost: e.target.value })}
                      />
                      <button
                        onClick={() => removeChoice(gi, ci)}
                        aria-label="Eliminar opción"
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addChoice(gi)} className={`${CHIP_OLIVE_OUTLINE} self-start mt-1`}>
                    + Agregar opción
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className={BTN_SECONDARY}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} className={BTN_PRIMARY}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
