// Order cutoff: 11pm the day before delivery, America/Mexico_City (UTC-6, no DST).
// 23:00 local on (dayDate - 1) is always 05:00 UTC on dayDate.
export function getCutoff(dayDate: string): Date {
  return new Date(`${dayDate}T05:00:00.000Z`);
}

export function isOrderable(dayDate: string, now: Date = new Date()): boolean {
  return now.getTime() < getCutoff(dayDate).getTime();
}

export function nextUpcomingCutoff(dayDates: string[], now: Date = new Date()): Date | null {
  const upcoming = dayDates
    .map(getCutoff)
    .filter((cutoff) => cutoff.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}
