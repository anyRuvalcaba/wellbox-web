import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4 py-10">
      <Link href="/pedido" className="flex flex-col items-center gap-2 mb-6">
        <Image src="/logo-wellbox.png" alt="WellBox" width={64} height={64} className="rounded-full" />
        <span className="font-display text-2xl text-olive-dark">wellBOX</span>
      </Link>
      {children}
    </div>
  );
}
