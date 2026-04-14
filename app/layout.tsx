import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clínica Natura — CRM Médico",
  description: "Sistema de gestión médica multi-clínica Clínica Natura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`} data-qb-installed="true">
      <body className="h-full">{children}</body>
    </html>
  );
}
