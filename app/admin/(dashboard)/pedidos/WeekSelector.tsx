"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function WeekSelector({
  menus,
  selected,
}: {
  menus: { id: string; label: string; isPublished: boolean }[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(menuId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("menu", menuId);
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-peach px-3 py-2 bg-white text-sm font-semibold"
    >
      <option value="all">Todas las semanas</option>
      {menus.map((menu) => (
        <option key={menu.id} value={menu.id}>
          {menu.label}
          {menu.isPublished ? " · publicada" : ""}
        </option>
      ))}
    </select>
  );
}
