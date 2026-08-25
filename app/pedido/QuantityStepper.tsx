"use client";

export default function QuantityStepper({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
}) {
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
        className="w-7 h-7 flex items-center justify-center rounded-full bg-cream-dark text-olive-dark font-bold"
        aria-label="Más"
      >
        +
      </button>
    </div>
  );
}
