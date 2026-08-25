import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMXN } from "@/lib/format";
import { TEXT_LINK } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireUser();
  const { id } = await searchParams;
  const supabase = await createClient();

  // La política de orders limita esto al pedido propio: con el id de otra persona no
  // devuelve nada.
  const { data: pedido } = id
    ? await supabase
        .from("orders")
        .select("id, total, delivery_location_name, payment_method_label, transfer_proof_url, payment_methods(type)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  const tipoPago = (pedido?.payment_methods as unknown as { type: string } | null)?.type;

  return (
    <div className="text-center py-12 flex flex-col items-center gap-4">
      <div className="text-5xl">{tipoPago === "transfer" ? "⏳" : "✅"}</div>
      <h1 className="font-display text-3xl text-olive-dark">¡Pedido registrado!</h1>

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
            ) : (
              <>
                Tu pedido quedó con{" "}
                <span className="font-semibold text-rust">pago pendiente</span>. El cobro en
                línea todavía no está activo, así que te contactamos por WhatsApp para
                completarlo. <span className="font-semibold">Aún no se te ha cobrado.</span>
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
      </div>
    </div>
  );
}
