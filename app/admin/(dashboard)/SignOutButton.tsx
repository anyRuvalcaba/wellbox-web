"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm font-semibold text-brown/60 underline underline-offset-2 decoration-brown/30 hover:text-brown hover:decoration-brown/60"
    >
      Cerrar sesión
    </button>
  );
}
