import Image from "next/image";
import Link from "next/link";
import { CartProvider } from "./cart-context";
import { getSessionProfile } from "@/lib/auth";
import AccountMenu from "./AccountMenu";
import CartIcon from "./CartIcon";

export default async function PedidoLayout({ children }: { children: React.ReactNode }) {
  // getSessionProfile y no requireUser: ver el menú no exige cuenta. El candado está
  // en avanzar del carrito hacia el resumen y el pago.
  const perfil = await getSessionProfile();

  return (
    <CartProvider nombreCuenta={perfil?.fullName ?? ""} telefonoCuenta={perfil?.phone ?? ""}>
      <div className="min-h-screen flex flex-col">
        <header className="bg-cream border-b border-peach px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="justify-self-start">
            <CartIcon />
          </div>
          <Link href="/" className="justify-self-center">
            <Image src="/logo-wellbox.png" alt="WellBox" width={96} height={96} className="h-16 w-16" />
          </Link>
          <div className="justify-self-end">
            <AccountMenu email={perfil?.email ?? null} esAdmin={perfil?.role === "admin"} />
          </div>
        </header>
        <main className="flex-1 max-w-xl w-full mx-auto px-4 pb-28 pt-4">{children}</main>
      </div>
    </CartProvider>
  );
}
