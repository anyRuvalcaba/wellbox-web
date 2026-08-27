"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";
import { revisarPassword } from "@/lib/password";

export default function RestablecerContrasenaPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [listo, setListo] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // El enlace del correo trae los tokens en el fragmento de la URL (#access_token=...).
    // El cliente de Supabase los detecta solo al cargar la página y avisa por este evento
    // cuando la sesión de recuperación queda lista — por eso no basta con leer la sesión
    // una sola vez al montar.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setListo(true);
      setVerificando(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problema = revisarPassword(password);
    if (problema) {
      setError(problema);
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      // Un "no se pudo, intenta de nuevo" genérico deja a la persona atorada sin saber
      // qué corregir: reintentar lo mismo va a fallar igual. Se traducen los motivos
      // que Supabase devuelve de verdad, y si aparece uno nuevo se muestra su mensaje
      // tal cual en vez de esconderlo.
      setError(traducirErrorDeContrasena(updateError.message));
      setLoading(false);
      return;
    }

    setExito(true);
    setLoading(false);
  }

  if (exito) {
    return (
      <div className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 text-center flex flex-col gap-3">
        <h1 className="font-display text-2xl text-olive-dark">Contraseña actualizada</h1>
        <p className="text-sm text-brown/70">Ya puedes entrar con tu nueva contraseña.</p>
        <button
          onClick={() => {
            router.push("/login");
            router.refresh();
          }}
          className={BTN_PRIMARY}
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  if (verificando) {
    return <p className="text-sm text-brown/70">Verificando enlace...</p>;
  }

  if (!listo) {
    return (
      <div className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 text-center flex flex-col gap-3">
        <h1 className="font-display text-2xl text-olive-dark">Enlace inválido o vencido</h1>
        <p className="text-sm text-brown/70">
          Este enlace ya no sirve — los enlaces de recuperación caducan. Pide uno nuevo.
        </p>
        <Link href="/recuperar-contrasena" className={TEXT_LINK}>
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 flex flex-col gap-4"
    >
      <h1 className="font-display text-2xl text-olive-dark text-center">Elige tu nueva contraseña</h1>

      <div>
        <label htmlFor="password" className="text-sm font-semibold block mb-1">
          Contraseña nueva
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-peach px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-brown/50 mt-1">
          Mínimo 8 caracteres, con mayúscula, minúscula y número
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className={BTN_PRIMARY}>
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}

// Los mensajes de Supabase llegan en inglés. Se traducen los que sí ocurren en la
// práctica; cualquier otro se muestra tal cual, porque un motivo raro en inglés sigue
// siendo más útil que "intenta de nuevo".
function traducirErrorDeContrasena(mensaje: string): string {
  const m = mensaje.toLowerCase();

  if (m.includes("different from the old password")) {
    return "Esa es la contraseña que ya tenías. Elige una distinta.";
  }
  if (m.includes("session") || m.includes("token")) {
    return "El enlace ya venció. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.";
  }
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) {
    return "Esa contraseña aparece en filtraciones conocidas. Elige otra.";
  }
  if (m.includes("at least") || m.includes("should contain") || m.includes("password")) {
    return "Esa contraseña no cumple los requisitos: mínimo 8 caracteres, con mayúscula, minúscula y número.";
  }
  if (m.includes("for security purposes") || m.includes("rate")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.";
  }

  return `No se pudo cambiar la contraseña: ${mensaje}`;
}
