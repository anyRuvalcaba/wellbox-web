"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TEXT_LINK } from "@/lib/ui";

function ConfirmacionContent() {
  const params = useSearchParams();
  const orderId = params.get("id");

  return (
    <div className="text-center py-12 flex flex-col items-center gap-4">
      <div className="text-5xl">⏳</div>
      <h1 className="font-display text-3xl text-olive-dark">¡Pedido registrado!</h1>
      <p className="text-brown/80 max-w-sm">
        Tu pedido y comprobante quedaron registrados. Está{" "}
        <span className="font-semibold text-rust">pendiente de confirmación</span> — en cuanto
        verifiquemos tu pago te confirmamos por WhatsApp.
      </p>
      {orderId && (
        <p className="text-xs text-brown/40">Folio: {orderId.slice(0, 8).toUpperCase()}</p>
      )}
      <Link href="/pedido" className={`mt-4 ${TEXT_LINK}`}>
        Hacer otro pedido
      </Link>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmacionContent />
    </Suspense>
  );
}
