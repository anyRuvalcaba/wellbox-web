import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "../public/fonts/Poppins-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/Poppins-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/Poppins-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../public/fonts/Poppins-Bold.otf", weight: "700", style: "normal" },
  ],
});

const theSeasons = localFont({
  variable: "--font-seasons",
  src: [
    { path: "../public/fonts/TheSeasons-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/TheSeasons-Bold.otf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "WellBox | Healthy Lunch",
  description: "Pide tu menú semanal WellBox y recíbelo a las 10am.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${poppins.variable} ${theSeasons.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
