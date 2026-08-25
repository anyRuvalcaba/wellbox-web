import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMXN } from "@/lib/format";
import { TEXT_LINK } from "@/lib/ui";
import { esFalloDeConexion } from "@/lib/db-error";
import EstadoSinConexion from "@/app/EstadoSinConexion";

export const dynamic = "force-dynamic";

const ETIQUETA_PAGO: Record<string, string> = {
  pending: "Pago pendiente",
  transfer_uploaded: "Comprobante enviado",
  confirmed: "Pago confirmado",
};

export default async function MisPedidosPage() {
  await requireUser();
  const supabase = await createClient();

  // Sin filtro por usuario a propósito: la política RLS de `orders` ya limita el
  // resultado a los pedidos propios. Filtrar aquí también escondería un error si esa
  // política se rompiera algún día — así, si algo falla, se nota.
  const { data: pedidos, error } = await supabase
    .from("orders")
    .select("id, created_at, total, payment_status, order_items(dish_name, day_label, quantity, unit_price)")
    .order("created_at", { ascending: false });

  // Ya revisaba `error`, pero con un mensaje genérico. Se distingue el patrón
  // verificado de fallo de conexión del componente compartido con el resto del sitio.
  if (esFalloDeConexion(error)) return <EstadoSinConexion />;

  if (error) {
    return (
      <p className="text-sm text-red-600">
        No pudimos cargar tus pedidos. Vuelve a intentar en un momento.
      </p>
    );
  }

  if (!pedidos || pedidos.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col gap-3">
        <p className="text-brown/70">Todavía no has hecho ningún pedido.</p>
        <Link href="/pedido" className={TEXT_LINK}>
          Ver el menú de la semana
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl text-olive-dark text-center">Mis pedidos</h1>

      {pedidos.map((pedido) => (
        <article key={pedido.id} className="bg-white border border-peach rounded-2xl p-4 flex flex-col gap-3">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <time className="text-sm text-brown/60" dateTime={pedido.created_at}>
              {new Date(pedido.created_at).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <span className="text-xs font-semibold text-olive-dark bg-cream-dark/60 rounded-full px-3 py-1">
              {ETIQUETA_PAGO[pedido.payment_status] ?? pedido.payment_status}
            </span>
          </header>

          <ul className="flex flex-col gap-1 text-sm">
            {pedido.order_items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-brown/80">
                  {item.day_label}: {item.dish_name}
                  {item.quantity > 1 && ` ×${item.quantity}`}
                </span>
                <span className="text-brown/60 whitespace-nowrap">
                  {formatMXN(item.unit_price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-right font-semibold text-rust border-t border-peach/60 pt-2">
            Total: {formatMXN(pedido.total)}
          </p>
        </article>
      ))}
    </div>
  );
}
