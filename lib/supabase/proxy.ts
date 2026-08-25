import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// Rutas que exigen sesión. Ver el menú NO la exige: es el escaparate del negocio y
// cerrarlo espantaría clientas. Lo que exige cuenta es avanzar en el pedido.
const RUTAS_PRIVADAS = ["/pedido/resumen", "/pedido/pago", "/pedido/mis-pedidos", "/pedido/perfil"];
const RUTAS_DE_AUTH = ["/login", "/registro"];

// Refresca la cookie de sesión de Supabase y hace el chequeo optimista de rutas.
//
// Esto es SOLO la primera capa: evita renderizar pantallas que el usuario no va a poder
// usar. La doc de Next 16 es explícita en que el proxy no debe ser la única defensa.
// La autorización real vive en lib/auth.ts (servidor) y sobre todo en las políticas RLS
// de Postgres, que rechazan la consulta aunque estas dos capas fallaran.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // El login de admin se unificó con el de clientas. Este redirect evita romper el
  // enlace que el equipo ya tiene guardado.
  if (pathname === "/admin/login") {
    return redirigirA(request, "/login");
  }

  const esRutaAdmin = pathname.startsWith("/admin");
  const esRutaPrivada = RUTAS_PRIVADAS.some((ruta) => pathname.startsWith(ruta));

  if ((esRutaAdmin || esRutaPrivada) && !user) {
    // `next` conserva a dónde iba, para devolverla ahí después de entrar y que no
    // pierda el pedido que ya venía armando.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (RUTAS_DE_AUTH.includes(pathname) && user) {
    return redirigirA(request, "/pedido");
  }

  return response;
}

function redirigirA(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
