import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/store/provider";
import { SupportWidget } from "@/components/store/support";

export const metadata: Metadata = {
  title: "Fritzoria — Toko Buku Fisik & Digital",
  description: "Temukan buku fisik dan e-book pilihan di Fritzoria.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased"><StoreProvider>{children}<SupportWidget /></StoreProvider></body>
    </html>
  );
}
