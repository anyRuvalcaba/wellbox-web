import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <Image src="/logo-wellbox.png" alt="WellBox" width={64} height={64} className="rounded-full mb-4" />
      {children}
    </div>
  );
}
