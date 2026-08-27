"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BTN_PRIMARY, TEXT_LINK } from "@/lib/ui";
import { revisarPassword } from "@/lib/password";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    deliveryLocationId: "",
  });
  const [puntos, setPuntos] = useState<{ id: string; name: string }[]>([]);

  // Los puntos activos se leen sin sesión: aquí todavía no hay cuenta.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("delivery_locations")
      .select("id, name")
      .order("position")
      .then(({ data }) => setPuntos(data ?? []));
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [revisaCorreo, setRevisaCorreo] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.deliveryLocationId) {
      setError("Elige tu punto de entrega.");
      return;
    }
    const problema = revisarPassword(form.password);
    if (problema) {
      setError(problema);
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // full_name y phone viajan en options.data → raw_user_meta_data. El trigger
    // handle_new_user() los copia a la tabla profiles al crearse la cuenta.
    // El rol NO se manda desde aquí: lo pone la base en 'customer' por default, y el
    // trigger protect_role() impide cambiarlo desde el cliente.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName.trim(), phone: form.phone.trim() },
      },
    });

    if (signUpError) {
      const mensaje = signUpError.message.toLowerCase();
      setError(
        mensaje.includes("already")
          ? "Ese correo ya tiene una cuenta. Inicia sesión."
          : mensaje.includes("password")
            // Supabase aplica su propia política de contraseñas. Si la rechaza, hay que
            // decir por qué: un "no se pudo" genérico deja a la clienta atorada sin
            // saber qué corregir.
            ? "Esa contraseña no cumple los requisitos: mínimo 8 caracteres, con mayúscula, minúscula y número."
            : "No se pudo crear la cuenta. Intenta de nuevo."
      );
      setLoading(false);
      return;
    }

    // Si el proyecto pide confirmación por correo, signUp no devuelve sesión. En ese
    // caso el punto de entrega se pide al entrar, porque escribirlo exige sesión.
    if (!data.session) {
      setRevisaCorreo(true);
      setLoading(false);
      return;
    }

    // El punto va después del alta y no en el metadata: es una llave foránea que hay
    // que validar contra delivery_locations, no un texto libre.
    await supabase
      .from("profiles")
      .update({ delivery_location_id: form.deliveryLocationId })
      .eq("id", data.user!.id);

    router.push("/pedido");
    router.refresh();
  }

  if (revisaCorreo) {
    return (
      <div className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 text-center flex flex-col gap-3">
        <h1 className="font-display text-2xl text-olive-dark">Revisa tu correo</h1>
        <p className="text-sm text-brown/70">
          Te mandamos un enlace a <span className="font-semibold">{form.email}</span> para
          confirmar tu cuenta.
        </p>
        <Link href="/login" className={TEXT_LINK}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white border border-peach rounded-2xl p-6 flex flex-col gap-4"
    >
      <h1 className="font-display text-2xl text-olive-dark text-center">Crea tu cuenta</h1>

      <Field id="fullName" label="Nombre completo" value={form.fullName} onChange={update("fullName")} autoComplete="name" />
      <Field id="phone" label="Teléfono" type="tel" value={form.phone} onChange={update("phone")} autoComplete="tel" />
      <Field id="email" label="Correo" type="email" value={form.email} onChange={update("email")} autoComplete="email" />

      <div>
        <label htmlFor="deliveryLocationId" className="text-sm font-semibold block mb-1">
          Punto de entrega
        </label>
        <select
          id="deliveryLocationId"
          required
          value={form.deliveryLocationId}
          onChange={update("deliveryLocationId")}
          className="w-full rounded-lg border border-peach px-3 py-2 bg-white"
        >
          <option value="">Elige dónde recibes...</option>
          {puntos.map((punto) => (
            <option key={punto.id} value={punto.id}>
              {punto.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-brown/50 mt-1">
          Es tu lugar de trabajo, así que queda fijo. Si cambias de sede, escríbenos y lo
          ajustamos.
        </p>
      </div>
      <Field
        id="password"
        label="Contraseña"
        type="password"
        value={form.password}
        onChange={update("password")}
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className={BTN_PRIMARY}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-sm text-center text-brown/70">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className={TEXT_LINK}>
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  type = "text",
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold block mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        className="w-full rounded-lg border border-peach px-3 py-2"
        {...props}
      />
      {hint && <p className="text-xs text-brown/50 mt-1">{hint}</p>}
    </div>
  );
}
