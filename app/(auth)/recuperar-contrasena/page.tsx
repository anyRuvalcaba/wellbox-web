"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    // No se revisa el resultado ni se distingue error de éxito: Supabase ya responde
    // igual exista o no la cuenta, para no confirmarle a un atacante qué correos están
    // registrados (mismo criterio que el mensaje genérico de login).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    });

    setLoading(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 text-center flex flex-col gap-3">
        <h1 className="font-display text-2xl text-olive-dark">Revisa tu correo</h1>
        <p className="text-sm text-brown/70">
          Si <span className="font-semibold">{email}</span> tiene una cuenta, te mandamos un
          enlace para restablecer tu contraseña.
        </p>
        <Link href="/login" className={TEXT_LINK}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 flex flex-col gap-4"
    >
      <h1 className="font-display text-2xl text-olive-dark text-center">Recuperar contraseña</h1>
      <p className="text-sm text-brown/70 text-center">
        Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva.
      </p>

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

      <button type="submit" disabled={loading} className={BTN_PRIMARY}>
        {loading ? "Enviando..." : "Mandar enlace"}
      </button>

      <p className="text-sm text-center text-brown/70">
        <Link href="/login" className={TEXT_LINK}>
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
