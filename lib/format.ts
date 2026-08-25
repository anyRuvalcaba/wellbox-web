export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatDayLabel(dayDate: string): string {
  const label = DAY_LABEL_FORMATTER.format(new Date(`${dayDate}T12:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatWeekRangeLabel(dayDates: string[]): string {
  if (dayDates.length === 0) return "";
  const sorted = [...dayDates].sort();
  const first = new Date(`${sorted[0]}T12:00:00.000Z`);
  const last = new Date(`${sorted[sorted.length - 1]}T12:00:00.000Z`);
  const firstDay = first.getUTCDate();
  const lastDay = last.getUTCDate();
  const firstMonth = MONTHS_ES[first.getUTCMonth()];
  const lastMonth = MONTHS_ES[last.getUTCMonth()];
  const firstYear = first.getUTCFullYear();
  const lastYear = last.getUTCFullYear();

  if (firstMonth === lastMonth && firstYear === lastYear) {
    return `${firstDay}–${lastDay} de ${firstMonth} ${firstYear}`;
  }
  if (firstYear === lastYear) {
    return `${firstDay} de ${firstMonth} – ${lastDay} de ${lastMonth} ${firstYear}`;
  }
  return `${firstDay} de ${firstMonth} ${firstYear} – ${lastDay} de ${lastMonth} ${lastYear}`;
}
