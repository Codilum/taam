import type { Metadata } from "next";
import { Geologica } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

// ✅ Твой бренд и favicon
export const metadata: Metadata = {
  title: "taam.menu — QR-меню для ресторанов",
  description: "Современное QR-меню для ресторанов и кафе. Быстро, удобно и стильно.",
  icons: {
    icon: [
      { url: "/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geologica.variable} antialiased`}>
        <main>{children}</main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}