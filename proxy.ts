import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/pedido/resumen",
    "/pedido/pago",
    "/pedido/mis-pedidos/:path*",
    "/login",
    "/registro",
  ],
};
