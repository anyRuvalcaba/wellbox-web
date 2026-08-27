import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import SignOutButton from "./SignOutButton";

const NAV = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/entregas", label: "Entregas" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // El layout muestra los datos del admin; la verificación de permiso vive en el DAL
  // (lib/auth.ts) y se repite en cada página, porque los layouts no se re-renderizan
  // al navegar entre rutas hijas.
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="bg-white border-b border-peach px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo-wellbox.png" alt="WellBox" width={56} height={56} className="h-14 w-14" />
            <span className="font-display text-sm text-brown/60">admin</span>
          </Link>
          <nav className="flex gap-3 sm:gap-4 flex-wrap">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-brown/70 underline underline-offset-4 decoration-transparent hover:decoration-olive-dark hover:text-olive-dark"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-sm text-brown/50 hidden sm:inline">{admin.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
