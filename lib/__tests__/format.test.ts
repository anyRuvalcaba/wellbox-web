import { describe, expect, it } from "vitest";
import { formatMXN, formatDayLabel, formatWeekRangeLabel } from "@/lib/format";

describe("formatMXN", () => {
  it("formatea con el símbolo de pesos y dos decimales", () => {
    expect(formatMXN(155)).toBe("$155.00");
    expect(formatMXN(0)).toBe("$0.00");
  });

  it("no trunca centavos", () => {
    expect(formatMXN(99.9)).toBe("$99.90");
  });

  it("usa separador de miles", () => {
    expect(formatMXN(1500)).toBe("$1,500.00");
  });
});

describe("formatDayLabel", () => {
  it("arranca en mayúscula y lleva el día del mes y el nombre del mes", () => {
    const etiqueta = formatDayLabel("2026-07-08");
    expect(etiqueta[0]).toBe(etiqueta[0].toUpperCase());
    expect(etiqueta).toContain("8");
    expect(etiqueta.toLowerCase()).toContain("julio");
  });

  it("usa acentos correctos para miércoles y sábado", () => {
    // Bug real de esta sesión (T-009): un mal manejo de codificación convirtió
    // "miércoles" en "mi√©rcoles" al pasar una migración por el portapapeles. Esta
    // prueba no puede pasar por accidente con ese mismo error: cuenta el carácter.
    expect(formatDayLabel("2026-07-08").toLowerCase()).toContain("miércoles");
    expect(formatDayLabel("2026-07-11").toLowerCase()).toContain("sábado");
  });
});

describe("formatWeekRangeLabel", () => {
  it("sin fechas, regresa cadena vacía", () => {
    expect(formatWeekRangeLabel([])).toBe("");
  });

  it("una semana dentro del mismo mes usa un solo mes y año", () => {
    const dias = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"];
    expect(formatWeekRangeLabel(dias)).toBe("6–10 de julio 2026");
  });

  it("no depende del orden de entrada — ordena las fechas internamente", () => {
    const enOrden = ["2026-07-06", "2026-07-07", "2026-07-10"];
    const desordenadas = ["2026-07-10", "2026-07-06", "2026-07-07"];
    expect(formatWeekRangeLabel(desordenadas)).toBe(formatWeekRangeLabel(enOrden));
  });

  it("una semana que cruza de mes muestra los dos meses", () => {
    const dias = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
    expect(formatWeekRangeLabel(dias)).toBe("30 de julio – 2 de agosto 2026");
  });

  it("un rango que cruza de año muestra los dos años", () => {
    const dias = ["2026-12-30", "2026-12-31", "2027-01-01"];
    expect(formatWeekRangeLabel(dias)).toBe("30 de diciembre 2026 – 1 de enero 2027");
  });
});
