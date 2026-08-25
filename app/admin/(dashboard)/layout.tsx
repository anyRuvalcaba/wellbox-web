import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

const NAV = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="bg-white border-b border-peach px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo-wellbox.png" alt="WellBox" width={32} height={32} className="rounded-full" />
            <span className="font-display text-xl text-olive-dark">wellBOX admin</span>
          </Link>
          <nav className="flex gap-4">
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
        <div className="flex items-center gap-4">
          <span className="text-sm text-brown/50">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
