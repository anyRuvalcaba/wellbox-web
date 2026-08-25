"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHIP_DANGER } from "@/lib/ui";

export default function DeleteMenuButton({
  menuId,
  weekStartDate,
  redirectTo,
}: {
  menuId: string;
  weekStartDate: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmed = confirm(
      `¿Eliminar por completo la semana del ${weekStartDate}? Se borrarán todos sus platillos y grupos de opciones. Los pedidos ya realizados se conservan, pero quedarán sin semana asociada.`
    );
    if (!confirmed) return;

    setLoading(true);
    const supabase = createClient();
    await supabase.from("menus").delete().eq("id", menuId);
    setLoading(false);

    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={CHIP_DANGER}
    >
      {loading ? "Eliminando..." : "Eliminar semana"}
    </button>
  );
}
