import { formatMXN } from "@/lib/format";

const DEFAULT_BAR = "bg-olive/50 border-olive/70";

// Paleta que va alternando color por barra, útil para distinguir una semana de otra.
const PALETTE = [
  "bg-olive/50 border-olive/70",
  "bg-rust/50 border-rust/70",
  "bg-olive-dark/50 border-olive-dark/70",
  "bg-peach/70 border-peach",
];

export default function BarChart({
  data,
  valueFormatter = formatMXN,
  multiColor = false,
}: {
  data: { label: string; value: number }[];
  valueFormatter?: (value: number) => string;
  multiColor?: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-brown/40">Sin datos todavía.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((d, i) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <span className="text-[11px] font-semibold text-brown/70">
            {d.value > 0 ? valueFormatter(d.value) : ""}
          </span>
          <div
            className={`w-full border rounded-t-md ${multiColor ? PALETTE[i % PALETTE.length] : DEFAULT_BAR}`}
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "0px" }}
          />
          <span className="text-[11px] text-brown/60 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
