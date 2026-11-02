import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Títulos: una grotesca de cartelería de transporte, firme y legible a la distancia.
const archivo = Archivo({
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
  // El azul marino del encabezado: la barra del navegador en el celular sigue al encabezado.
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${archivo.variable}`}>
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
