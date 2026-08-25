import { describe, expect, it } from "vitest";
import { aCentavos, MONEDA } from "@/lib/dinero";

// Se prueba sin STRIPE_SECRET_KEY en el entorno: lib/dinero.ts no importa el SDK de
// Stripe. Si esta prueba fallara por una variable de entorno faltante, sería la señal
// de que algo volvió a acoplar este archivo con lib/stripe/server.ts.
describe("aCentavos", () => {
  it("convierte pesos enteros a centavos", () => {
    expect(aCentavos(155)).toBe(15500);
    expect(aCentavos(0)).toBe(0);
  });

  it("redondea en vez de truncar — la razón por la que existe esta función", () => {
    // Los totales salen de sumar precios que Postgres devuelve como numeric; un
    // 154.999...  truncado con parseInt cobraría un peso de menos. Math.round no.
    expect(aCentavos(154.999)).toBe(15500);
    expect(aCentavos(154.001)).toBe(15400);
  });

  it("no acumula error de punto flotante en sumas típicas del carrito", () => {
    // 0.1 + 0.2 === 0.30000000000000004 en punto flotante — el caso clásico. Un total
    // de carrito armado sumando precios con centavos puede caer exactamente aquí.
    const total = 130 + 15.5 + 0.5; // = 146 en teoría
    expect(aCentavos(total)).toBe(14600);
  });
});

describe("MONEDA", () => {
  it("es mxn — WellBox cobra en pesos mexicanos", () => {
    expect(MONEDA).toBe("mxn");
  });
});
