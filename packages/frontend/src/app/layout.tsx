import type { Metadata } from "next";
import { Fraunces, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-heading",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Nalakalu — Asistente de Procedimientos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}>
      <body className="bg-app antialiased font-body">{children}</body>
    </html>
  );
}
