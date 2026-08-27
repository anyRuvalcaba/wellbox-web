"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountMenu({ email, esAdmin }: { email: string | null; esAdmin: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  if (!email) {
    return (
      <Link
        href="/login"
        className="text-sm font-semibold text-olive-dark underline underline-offset-4 decoration-olive/40"
      >
        Entrar
      </Link>
    );
  }

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Al inicio y no al menú: cerrar sesión es salirse, y el menú es una pantalla de
    // "ya estoy pidiendo". Quien cierra sesión espera aterrizar en la portada.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        // En pantalla chica solo cabe la inicial; desde sm se muestra el correo.
        className="flex items-center gap-2 text-sm font-semibold text-olive-dark rounded-full border border-peach bg-white px-3 py-1.5"
      >
        <span className="sm:hidden">{email[0]?.toUpperCase()}</span>
        <span className="hidden sm:inline max-w-[12rem] truncate">{email}</span>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-white border border-peach rounded-xl shadow-lg py-1 z-20"
        >
          <Link
            href="/pedido/perfil"
            role="menuitem"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2 text-sm text-brown/80 hover:bg-cream-dark/40"
          >
            Mi perfil
          </Link>
          <Link
            href="/pedido/mis-pedidos"
            role="menuitem"
            onClick={() => setAbierto(false)}
            className="block px-4 py-2 text-sm text-brown/80 hover:bg-cream-dark/40"
          >
            Mis pedidos
          </Link>
          {esAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 text-sm text-brown/80 hover:bg-cream-dark/40"
            >
              Panel admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={salir}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-cream-dark/40"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
