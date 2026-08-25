"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { describirMetodo, ETIQUETA_TIPO, type MetodoPago } from "@/lib/pagos";
import { CHIP_DANGER, CHIP_OLIVE_OUTLINE, TEXT_LINK } from "@/lib/ui";
import FormularioMetodo from "./FormularioMetodo";

export default function MetodosPago({
  userId,
  metodos,
}: {
  userId: string;
  metodos: MetodoPago[];
}) {
  const router = useRouter();
  const [agregando, setAgregando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hacerPredeterminado(id: string) {
    setTrabajando(id);
    setError(null);
    const supabase = createClient();
    // Función de Postgres: quitar el anterior y poner el nuevo van en la misma
    // transacción, para que no quede un momento sin ningún predeterminado.
    const { error: rpcError } = await supabase.rpc("set_default_payment_method", {
      method_id: id,
    });
    setTrabajando(null);
    if (rpcError) {
      setError("No se pudo cambiar el método predeterminado.");
      return;
    }
    router.refresh();
  }

  async function eliminar(id: string, descripcion: string) {
    if (!confirm(`¿Eliminar ${descripcion}?`)) return;
    setTrabajando(id);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("payment_methods").delete().eq("id", id);
    setTrabajando(null);
    if (deleteError) {
      setError("No se pudo eliminar el método de pago.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-olive-dark">Mis formas de pago</h2>
        {!agregando && (
          <button onClick={() => setAgregando(true)} className={TEXT_LINK}>
            + Agregar
          </button>
        )}
      </div>

      {metodos.length === 0 && !agregando && (
        <p className="text-sm text-brown/60">
          Todavía no tienes formas de pago guardadas. Agrega una para pedir más rápido.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {metodos.map((metodo) => (
          <div
            key={metodo.id}
            className="bg-white border border-peach rounded-xl px-3 py-2 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">{describirMetodo(metodo)}</p>
              <p className="text-xs text-brown/50">
                {ETIQUETA_TIPO[metodo.type]}
                {metodo.isDefault && " · Predeterminada"}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              {!metodo.isDefault && (
                <button
                  onClick={() => hacerPredeterminado(metodo.id)}
                  disabled={trabajando !== null}
                  className={CHIP_OLIVE_OUTLINE}
                >
                  {trabajando === metodo.id ? "..." : "Usar por defecto"}
                </button>
              )}
              <button
                onClick={() => eliminar(metodo.id, describirMetodo(metodo))}
                disabled={trabajando !== null}
                className={CHIP_DANGER}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {agregando && (
        <FormularioMetodo
          userId={userId}
          primerMetodo={metodos.length === 0}
          onCancelar={() => setAgregando(false)}
          onListo={() => {
            setAgregando(false);
            router.refresh();
          }}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
