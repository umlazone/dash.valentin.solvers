import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solvers Mission Control",
  description: "Content factory + operations board for Solvers / @valentinflrz",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  );
}
