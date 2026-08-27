"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY } from "@/lib/ui";

export default function SettingsForm({ initialValues }: { initialValues: Record<string, string> }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("settings")
      .upsert(Object.entries(values).map(([key, value]) => ({ key, value })));
    setSaving(false);
    setSaved(true);
  }

  function field(key: string, label: string, placeholder?: string) {
    return (
      <div>
        <label className="text-sm font-semibold block mb-1">{label}</label>
        <input
          className="w-full rounded-lg border border-peach px-3 py-2"
          placeholder={placeholder}
          value={values[key] ?? ""}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-peach rounded-2xl p-5 flex flex-col gap-4 max-w-lg">
      <h2 className="font-semibold">Datos de pago (transferencia)</h2>
      {field("bank_clabe", "CLABE")}
      {field("bank_name", "Banco")}
      {field("bank_holder", "Beneficiario")}
      <div>
        <label className="text-sm font-semibold block mb-1">Nota / referencia para el cliente</label>
        <textarea
          className="w-full rounded-lg border border-peach px-3 py-2"
          rows={2}
          value={values.bank_reference_note ?? ""}
          onChange={(e) => setValues({ ...values, bank_reference_note: e.target.value })}
        />
      </div>

      <h2 className="font-semibold mt-2">Notificaciones</h2>
      {field("whatsapp_number", "WhatsApp del negocio", "Ej. 5215512345678")}

      <button type="submit" disabled={saving} className={`self-start ${BTN_PRIMARY}`}>
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
      {saved && <p className="text-sm text-olive">Guardado.</p>}
    </form>
  );
}
