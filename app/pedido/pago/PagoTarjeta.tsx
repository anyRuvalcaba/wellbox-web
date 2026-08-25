"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { obtenerStripe } from "@/lib/stripe/cliente";
import { formatMXN } from "@/lib/format";
import { BTN_PRIMARY } from "@/lib/ui";

export default function PagoTarjeta({
  clientSecret,
  customerSessionClientSecret,
  orderId,
  total,
}: {
  clientSecret: string;
  customerSessionClientSecret: string;
  orderId: string;
  total: number;
}) {
  return (
    <Elements
      stripe={obtenerStripe()}
      options={{
        clientSecret,
        // Esto es lo que hace que el Payment Element muestre las tarjetas guardadas de
        // esta clienta, y le permita agregar una nueva o borrar una vieja.
        customerSessionClientSecret,
        locale: "es",
        appearance: {
          theme: "flat",
          variables: { colorPrimary: "#6b7a4f", borderRadius: "12px" },
        },
      }}
    >
      <FormularioTarjeta orderId={orderId} total={total} />
    </Elements>
  );
}

function FormularioTarjeta({ orderId, total }: { orderId: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPagando(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Si la tarjeta exige autenticación (3D Secure), Stripe manda a la clienta al
        // banco y la regresa aquí. La confirmación verifica el estado contra Stripe.
        return_url: `${window.location.origin}/pedido/confirmacion?id=${orderId}`,
      },
      // Sin redirección cuando no hace falta: la mayoría de las tarjetas resuelven
      // aquí mismo y la clienta no ve un salto innecesario.
      redirect: "if_required",
    });

    if (stripeError) {
      // Mensajes de Stripe: vienen localizados y dicen algo útil ("tu tarjeta fue
      // rechazada"), a diferencia de un error genérico nuestro.
      setError(stripeError.message ?? "No se pudo procesar tu pago.");
      setPagando(false);
      return;
    }

    // Llegó aquí sin redirección: el cobro se resolvió. Quién decide si quedó pagado es
    // el servidor preguntándole a Stripe, no esta pantalla.
    router.push(`/pedido/confirmacion?id=${orderId}`);
  }

  return (
    <form onSubmit={pagar} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "accordion" }} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={!stripe || pagando} className={`${BTN_PRIMARY} w-full py-3`}>
        {pagando ? "Procesando..." : `Pagar ${formatMXN(total)}`}
      </button>

      <p className="text-xs text-brown/50 text-center">
        Pago procesado por Stripe. WellBox no recibe ni guarda los datos de tu tarjeta.
      </p>
    </form>
  );
}
