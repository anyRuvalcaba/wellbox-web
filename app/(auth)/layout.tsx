import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4 py-10">
      <Link href="/pedido" className="mb-6">
        <Image src="/logo-wellbox.png" alt="WellBox" width={160} height={160} className="h-40 w-40" />
      </Link>
      {children}
    </div>
  );
}
