"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";

export default function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      // Mensaje genérico a propósito: distinguir "no existe la cuenta" de "contraseña
      // incorrecta" le confirma a un atacante qué correos están registrados.
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // El destino depende del rol. La política de profiles deja leer el propio perfil.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const destino = profile?.role === "admin" ? "/admin" : (next ?? "/pedido");

    router.push(destino);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 flex flex-col gap-4"
    >
      <h1 className="font-display text-2xl text-olive-dark text-center">Iniciar sesión</h1>

      <div>
        <label htmlFor="email" className="text-sm font-semibold block mb-1">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-peach px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-semibold block mb-1">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-peach px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className={BTN_PRIMARY}>
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-sm text-center text-brown/70">
        ¿Primera vez?{" "}
        <Link href="/registro" className={TEXT_LINK}>
          Crea tu cuenta
        </Link>
      </p>
    </form>
  );
}
