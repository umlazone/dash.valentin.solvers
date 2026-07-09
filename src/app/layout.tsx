import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mission Control · Solvers",
  description:
    "Content factory ops board for Solvers / @valentinflrz — status, drafts, weekly plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
