"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

// Vive en el header para que el carrito se vea desde cualquier pantalla de /pedido
// (perfil, mis pedidos...), no solo mientras se ve el menú — ahí ya existe CartBar,
// pero es propio de MenuBrowser y desaparece en las demás rutas.
export default function CartIcon() {
  const cart = useCart();
  const cantidad = cart.items.length;

  return (
    <Link
      href="/pedido/resumen"
      aria-label={cantidad > 0 ? `Carrito, ${cantidad} día(s) seleccionado(s)` : "Carrito vacío"}
      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-peach bg-white text-olive-dark"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 7h12l1.5 12a2 2 0 0 1-2 2.2H6.5a2 2 0 0 1-2-2.2L6 7Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {cantidad > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rust text-cream text-[10px] font-semibold">
          {cantidad}
        </span>
      )}
    </Link>
  );
}
