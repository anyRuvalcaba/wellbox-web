import { describe, expect, it } from "vitest";
import { esFalloDeConexion } from "@/lib/db-error";

// Se verificó en T-004, antes de escribir esta función, contra un puerto sin nada
// escuchando: supabase-js no lanza excepción, devuelve
// { data: null, error: { message: "TypeError: fetch failed", code: "" } }. Es el patrón
// exacto que esta función tiene que reconocer.
describe("esFalloDeConexion", () => {
  it("reconoce el patrón verificado: TypeError: fetch failed", () => {
    expect(esFalloDeConexion({ message: "TypeError: fetch failed", code: "" })).toBe(true);
  });

  it("no distingue mayúsculas de minúsculas", () => {
    expect(esFalloDeConexion({ message: "TYPEERROR: FETCH FAILED" })).toBe(true);
  });

  it("reconoce otras variantes comunes de fallo de red en Node", () => {
    expect(esFalloDeConexion({ message: "connect ECONNREFUSED 127.0.0.1:5432" })).toBe(true);
    expect(esFalloDeConexion({ message: "request to https://x.co failed, reason: ETIMEDOUT" })).toBe(true);
  });

  it("null no es un fallo de conexión — es la ausencia de error", () => {
    expect(esFalloDeConexion(null)).toBe(false);
  });

  it("un error real de Postgres, con código propio, no cuenta como fallo de conexión", () => {
    // Sin esto, un error de datos legítimo (una violación de restricción, por ejemplo)
    // se mostraría como 'problemas para conectarnos' — un diagnóstico equivocado.
    expect(
      esFalloDeConexion({ message: "duplicate key value violates unique constraint", code: "23505" })
    ).toBe(false);
  });

  it("un objeto de error sin message no truena, solo no cuenta como fallo de conexión", () => {
    expect(esFalloDeConexion({})).toBe(false);
  });
});
