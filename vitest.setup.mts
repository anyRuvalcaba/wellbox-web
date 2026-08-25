import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// A diferencia de Jest, Vitest no desmonta el DOM entre pruebas solo — sin esto, los
// renders de una prueba se quedan encimados en la del componente siguiente y consultas
// como getByLabelText encuentran varios elementos donde debería haber uno.
afterEach(() => {
  cleanup();
});
