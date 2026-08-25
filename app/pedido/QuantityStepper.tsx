"use client";

export default function QuantityStepper({
  quantity,
  onChange,
  max,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  // Tope de cortesía en el navegador, tomado del stock que vio la página al cargar. No
  // es la defensa real: el servidor revalida contra la disponibilidad en el momento de
  // pagar, porque este número puede quedar desactualizado si alguien más compra mientras
  // tanto.
  max?: number;
}) {
  const enElTope = max !== undefined && quantity >= max;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= 1}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-olive-dark font-bold disabled:opacity-40"
        aria-label="Menos"
      >
        −
      </button>
      <span className="w-5 text-center font-semibold">{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={enElTope}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-olive-dark font-bold disabled:opacity-40"
        aria-label="Más"
      >
        +
      </button>
    </div>
  );
}
