import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

const KEYS = ["bank_clabe", "bank_name", "bank_holder", "bank_reference_note", "whatsapp_number"] as const;

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value").in("key", KEYS);

  const values: Record<string, string> = {};
  for (const key of KEYS) values[key] = "";
  for (const row of data ?? []) values[row.key] = row.value ?? "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-olive-dark">Ajustes</h1>
      <SettingsForm initialValues={values} />
    </div>
  );
}
