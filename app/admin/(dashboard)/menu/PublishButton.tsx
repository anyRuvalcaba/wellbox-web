"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHIP_BASE } from "@/lib/ui";

export default function PublishButton({ menuId, isPublished }: { menuId: string; isPublished: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/menu/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuId, publish: !isPublished }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${CHIP_BASE} ${isPublished ? "bg-olive text-cream" : "bg-cream-dark text-brown"}`}
    >
      {isPublished ? "Publicado · despublicar" : "Publicar"}
    </button>
  );
}
