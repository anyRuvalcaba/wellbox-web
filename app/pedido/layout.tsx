import Image from "next/image";
import Link from "next/link";
import { CartProvider } from "./cart-context";

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <header className="bg-cream border-b border-peach px-4 py-3 flex items-center justify-center">
          <Link href="/pedido" className="flex items-center gap-2">
            <Image src="/logo-wellbox.png" alt="WellBox" width={40} height={40} className="rounded-full" />
            <span className="font-display text-2xl text-olive-dark">wellBOX</span>
          </Link>
        </header>
        <main className="flex-1 max-w-xl w-full mx-auto px-4 pb-28 pt-4">{children}</main>
      </div>
    </CartProvider>
  );
}
