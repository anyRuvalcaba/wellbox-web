"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes de confirmar" },
  { value: "confirmed", label: "Confirmados" },
];

export default function StatusFilter({ selected }: { selected: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 bg-cream-dark/50 rounded-full p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 whitespace-nowrap ${
            selected === opt.value ? "bg-olive text-cream" : "text-brown/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
