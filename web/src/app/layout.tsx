import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Fletes Tucumán", template: "%s · Fletes Tucumán" },
  description:
    "Conectamos a quienes necesitan trasladar algo en Tucumán con fleteros de moto, auto, camioneta y camión.",
};

export const viewport: Viewport = {
  themeColor: "#ede4cf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
