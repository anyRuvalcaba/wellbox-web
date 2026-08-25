import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuantityStepper from "../QuantityStepper";

// Esta es la pieza de interfaz que T-003 construyó para no dejar pedir más de lo que
// hay en stock. El servidor sigue siendo quien de verdad lo impide (verificar_stock()
// en Postgres, probado con dos conexiones reales compitiendo en supabase/test/), pero
// que el botón "+" se desactive aquí es lo que evita la frustración de armar un pedido
// que el servidor va a rechazar.
describe("QuantityStepper", () => {
  it("el botón '+' está activo cuando no hay tope", () => {
    render(<QuantityStepper quantity={1} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Más")).not.toBeDisabled();
  });

  it("el botón '+' se desactiva exactamente al llegar al tope de stock", () => {
    render(<QuantityStepper quantity={3} onChange={vi.fn()} max={3} />);
    expect(screen.getByLabelText("Más")).toBeDisabled();
  });

  it("el botón '+' sigue activo un paso antes del tope", () => {
    render(<QuantityStepper quantity={2} onChange={vi.fn()} max={3} />);
    expect(screen.getByLabelText("Más")).not.toBeDisabled();
  });

  it("el botón '−' se desactiva en 1 — no se puede pedir cantidad cero", () => {
    render(<QuantityStepper quantity={1} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Menos")).toBeDisabled();
  });

  it("tocar '+' llama a onChange con la cantidad siguiente, no la muta directamente", () => {
    // El componente no lleva su propio estado: quien lo usa decide qué pasa con el
    // número. Confirma que solo notifica la intención.
    const onChange = vi.fn();
    render(<QuantityStepper quantity={2} onChange={onChange} max={5} />);
    fireEvent.click(screen.getByLabelText("Más"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("tocar '−' llama a onChange con la cantidad anterior", () => {
    const onChange = vi.fn();
    render(<QuantityStepper quantity={2} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Menos"));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
