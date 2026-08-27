import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMXN } from "@/lib/format";
import { TEXT_LINK } from "@/lib/ui";
import { verificarPagoDelPedido } from "@/lib/stripe/verificar";

export const dynamic = "force-dynamic";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireUser();
  const { id } = await searchParams;
  const supabase = await createClient();

  // Primero se comprueba que el pedido sea de quien pregunta: la política de `orders`
  // no devuelve nada si el id es de otra persona. Solo entonces se le pregunta a Stripe
  // si el cobro ocurrió — porque esa verificación escribe con permisos de sistema y no
  // debe dispararse sobre pedidos ajenos.
  if (id) {
    const { data: esMio } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    // Si la clienta llegó aquí tras autenticarse con su banco (3D Secure), este es el
    // momento en que el pedido pasa a 'paid'.
    if (esMio) await verificarPagoDelPedido(id);
  }

  const { data: pedido } = id
    ? await supabase
        .from("orders")
        .select("id, total, payment_status, payment_error, delivery_location_name, payment_method_label, payment_methods(type)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  const tipoPago = (pedido?.payment_methods as unknown as { type: string } | null)?.type;
  // Sin método guardado y con estado de cobro, fue tarjeta: las tarjetas no viven en
  // payment_methods.
  const conTarjeta = !tipoPago;
  const pagado = pedido?.payment_status === "paid";
  const fallo = pedido?.payment_status === "failed";

  return (
    <div className="text-center py-12 flex flex-col items-center gap-4">
      <div className="text-5xl">{fallo ? "⚠️" : tipoPago === "transfer" ? "⏳" : "✅"}</div>
      <h1 className="font-display text-3xl text-olive-dark">
        {fallo ? "Tu pago no se completó" : "¡Pedido registrado!"}
      </h1>

      {pedido ? (
        <>
          <div className="bg-white/70 border border-peach rounded-2xl p-4 text-sm w-full max-w-sm flex flex-col gap-1">
            <p className="font-semibold text-rust">{formatMXN(pedido.total)}</p>
            {pedido.delivery_location_name && (
              <p className="text-brown/70">Entrega en {pedido.delivery_location_name}</p>
            )}
            {pedido.payment_method_label && (
              <p className="text-brown/70">Pago con {pedido.payment_method_label}</p>
            )}
          </div>

          {/* Cada forma de pago deja a la clienta en una situación distinta. Decir
              "quedó pendiente de confirmación" cuando pagó en efectivo la deja con la
              duda de si debe hacer algo más. */}
          <p className="text-brown/80 max-w-sm">
            {tipoPago === "transfer" ? (
              <>
                Recibimos tu comprobante. Tu pago está{" "}
                <span className="font-semibold text-rust">pendiente de confirmación</span> —
                en cuanto lo verifiquemos te avisamos por WhatsApp.
              </>
            ) : tipoPago === "cash" ? (
              <>
                Recibimos tu pago <span className="font-semibold">en efectivo</span> cuando
                entreguemos tu pedido. Te recomendamos llevar el monto exacto.
              </>
            ) : conTarjeta && pagado ? (
              <>
                <span className="font-semibold text-olive-dark">Tu pago se procesó</span>. Te
                confirmamos por WhatsApp antes de la entrega.
              </>
            ) : conTarjeta && fallo ? (
              <>
                {pedido.payment_error ?? "Tu tarjeta fue rechazada."}{" "}
                <span className="font-semibold">No se te cobró nada.</span> Puedes intentar
                con otra tarjeta desde el menú.
              </>
            ) : (
              <>
                Tu pago está <span className="font-semibold text-rust">en proceso</span>. En
                cuanto se confirme te avisamos por WhatsApp.
              </>
            )}
          </p>

          <p className="text-xs text-brown/40">
            Folio: {pedido.id.slice(0, 8).toUpperCase()}
          </p>
        </>
      ) : (
        <p className="text-brown/80 max-w-sm">
          Tu pedido quedó registrado. Te confirmamos por WhatsApp.
        </p>
      )}

      <div className="flex flex-col gap-2 mt-4">
        <Link href="/pedido/mis-pedidos" className={TEXT_LINK}>
          Ver mis pedidos
        </Link>
        <Link href="/pedido" className={TEXT_LINK}>
          Hacer otro pedido
        </Link>
        <Link href="/" className={TEXT_LINK}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
