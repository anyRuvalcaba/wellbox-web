import { describe, expect, it } from "vitest";
import { addDaysISO } from "@/lib/date";

// La usa duplicate_menu_week (T-009) para correr las fechas de una semana copiada. Un
// desfase de un día aquí correría mal la semana entera que se duplica.
describe("addDaysISO", () => {
  it("suma días dentro del mismo mes", () => {
    expect(addDaysISO("2026-07-06", 1)).toBe("2026-07-07");
    expect(addDaysISO("2026-07-06", 4)).toBe("2026-07-10");
  });

  it("cruza el fin de mes", () => {
    expect(addDaysISO("2026-07-30", 2)).toBe("2026-08-01");
  });

  it("cruza el fin de año", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("cruza el 29 de febrero en año bisiesto", () => {
    // 2028 sí es bisiesto; confirma que no se usa una tabla de días fija por mes.
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2028-02-28", 2)).toBe("2028-03-01");
  });

  it("con 0 días, regresa la misma fecha", () => {
    expect(addDaysISO("2026-07-06", 0)).toBe("2026-07-06");
  });
});
