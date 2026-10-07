import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // El repo raíz tiene su propio package-lock (app anterior): la raíz de esta app es web/.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    // Solo imágenes de Supabase Storage (públicas y URLs firmadas); nada de hosts arbitrarios.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" }],
  },
  // @react-pdf/renderer trae WebAssembly (yoga) y fuentes estándar: se usa tal cual desde node_modules.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
