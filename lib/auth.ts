import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "admin";

export interface SessionProfile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
}

// Data Access Layer.
//
// La doc de Next 16 (app/guides/authentication) desaconseja hacer el chequeo de sesión
// en el layout: por Partial Rendering los layouts no se vuelven a renderizar al navegar,
// así que la sesión no se revisa en cada cambio de ruta. La verificación va aquí, junto
// al acceso a datos, y se llama desde cada página.
//
// Esta es la segunda de tres capas: proxy.ts hace el chequeo optimista para no renderizar
// de más, esto valida la sesión real en el servidor, y las políticas RLS de Postgres son
// la defensa que de verdad cuenta. Si estas dos primeras fallaran, la base sigue
// rechazando la consulta.
//
// cache() memoriza el resultado durante un mismo render, para no pedirle el usuario a
// Supabase una vez por componente.
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();

  // getUser() valida el token contra Supabase. getSession() lee la cookie sin verificarla,
  // así que no sirve para decidir permisos.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: profile?.role === "admin" ? "admin" : "customer",
  };
});

export async function requireUser(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  // Un cliente autenticado que llega a /admin no es un error de sesión: es alguien que
  // no tiene por qué estar aquí. Se manda al pedido, no al login.
  if (profile.role !== "admin") redirect("/pedido");
  return profile;
}
