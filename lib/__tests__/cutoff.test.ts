import { describe, expect, it } from "vitest";
import { getCutoff, isOrderable, nextUpcomingCutoff } from "@/lib/cutoff";

// El cierre es a las 11pm (hora de México, UTC-6 fijo, sin horario de verano) del día
// anterior a la entrega. En UTC eso es siempre las 05:00 del propio día de entrega —
// por eso getCutoff no necesita saber en qué zona horaria corre el servidor.
describe("getCutoff", () => {
  it("el cierre del 10 de julio es las 05:00 UTC del 10 de julio (23:00 del 9 en México)", () => {
    const cierre = getCutoff("2026-07-10");
    expect(cierre.toISOString()).toBe("2026-07-10T05:00:00.000Z");
  });

  it("no se mueve con el horario de verano de EE.UU. — México no lo usa desde 2022", () => {
    // Un día de julio (bajo DST en EE.UU. si aplicara) y uno de enero deben dar la
    // misma hora UTC de cierre relativa a su propio día.
    expect(getCutoff("2026-01-15").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(getCutoff("2026-07-15").toISOString()).toBe("2026-07-15T05:00:00.000Z");
  });
});

describe("isOrderable", () => {
  it("todavía se puede pedir un minuto antes del cierre", () => {
    const unMinutoAntes = new Date("2026-07-10T04:59:00.000Z");
    expect(isOrderable("2026-07-10", unMinutoAntes)).toBe(true);
  });

  it("ya no se puede pedir justo en el instante del cierre", () => {
    // Frontera exacta: la comparación es estrictamente "menor que", así que el
    // instante mismo del cierre ya cuenta como cerrado, no como el último segundo hábil.
    const momentoExacto = new Date("2026-07-10T05:00:00.000Z");
    expect(isOrderable("2026-07-10", momentoExacto)).toBe(false);
  });

  it("ya no se puede pedir un minuto después del cierre", () => {
    const unMinutoDespues = new Date("2026-07-10T05:01:00.000Z");
    expect(isOrderable("2026-07-10", unMinutoDespues)).toBe(false);
  });
});

describe("nextUpcomingCutoff", () => {
  it("de varios días, regresa el cierre más próximo que todavía no pasó", () => {
    const ahora = new Date("2026-07-08T00:00:00.000Z");
    const dias = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"];
    // Los cierres de lunes y martes (6 y 7) ya pasaron respecto a "ahora". El próximo
    // es el del miércoles 8.
    expect(nextUpcomingCutoff(dias, ahora)?.toISOString()).toBe("2026-07-08T05:00:00.000Z");
  });

  it("si ya cerraron todos, no hay próximo cierre", () => {
    const ahora = new Date("2026-07-20T00:00:00.000Z");
    const dias = ["2026-07-06", "2026-07-07"];
    expect(nextUpcomingCutoff(dias, ahora)).toBeNull();
  });

  it("sin días, no hay próximo cierre", () => {
    expect(nextUpcomingCutoff([], new Date())).toBeNull();
  });
});
