import { describe, expect, it } from "vitest";
import { describirMetodo, ETIQUETA_TIPO, type MetodoPago } from "@/lib/pagos";

function metodo(datos: Partial<MetodoPago>): MetodoPago {
  return { id: "1", type: "cash", label: null, isDefault: false, ...datos };
}

describe("describirMetodo", () => {
  it("usa la etiqueta personalizada cuando existe", () => {
    expect(describirMetodo(metodo({ label: "Mi banco" }))).toBe("Mi banco");
  });

  it("recorta espacios de la etiqueta personalizada", () => {
    expect(describirMetodo(metodo({ label: "  Mi banco  " }))).toBe("Mi banco");
  });

  it("una etiqueta de solo espacios no cuenta como etiqueta", () => {
    // "   ".trim() es "", que es falsy — cae al nombre del tipo. Si esto no se probara,
    // un espacio suelto en el formulario del checkout mostraría un pago sin nombre.
    expect(describirMetodo(metodo({ label: "   ", type: "transfer" }))).toBe(
      ETIQUETA_TIPO.transfer
    );
  });

  it("sin etiqueta, usa el nombre del tipo de pago", () => {
    expect(describirMetodo(metodo({ label: null, type: "cash" }))).toBe("Efectivo");
    expect(describirMetodo(metodo({ label: null, type: "transfer" }))).toBe("Transferencia");
  });
});
