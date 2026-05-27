import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nalakalu — Asistente de Procedimientos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-app antialiased">{children}</body>
    </html>
  );
}
