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
  // La app vive en web/ (el vercel.json de la raíz la compila desde ahí): el tracing arranca acá.
  outputFileTracingRoot: path.join(__dirname),
  // Turbopack (next dev): la raíz es web/, no la del repo (que tiene su propio package.json).
  turbopack: { root: path.join(__dirname) },
  images: {
    // Solo imágenes de Supabase Storage (públicas y URLs firmadas); nada de hosts arbitrarios.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" }],
  },
  // @react-pdf/renderer trae WebAssembly (yoga) y fuentes estándar: se usa tal cual desde node_modules.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
    // Caché del navegador para las páginas dinámicas: volver a una página visitada (o precargada
    // desde la navegación) en los últimos 30 s es instantáneo. Las Server Actions con
    // revalidatePath y router.refresh() la invalidan, así que lo que cambia el usuario se ve al toque.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Rutas anteriores a la organización por rol: links viejos y notificaciones ya guardadas siguen
  // funcionando. Las que necesitan buscar el pedido (fletes y conversaciones por id) son páginas.
  async redirects() {
    return [
      { source: "/cliente/solicitudes/nueva", destination: "/cliente/nuevo", permanent: true },
      { source: "/cliente/solicitudes/:id", destination: "/cliente/pedido/:id", permanent: true },
      { source: "/cliente/solicitudes", destination: "/cliente", permanent: true },
      { source: "/cliente/perfil", destination: "/perfil", permanent: true },
      { source: "/cliente/mensajes", destination: "/chat", permanent: true },
      { source: "/fletero/solicitudes/:id", destination: "/fletero/pedido/:id", permanent: true },
      { source: "/fletero/solicitudes", destination: "/fletero", permanent: true },
      { source: "/fletero/agenda", destination: "/fletero/trabajos", permanent: true },
      { source: "/fletero/presupuestos", destination: "/fletero/trabajos?tab=presupuestos", permanent: true },
      { source: "/fletero/mensajes", destination: "/chat", permanent: true },
      { source: "/admin/usuarios", destination: "/admin/fleteros?tab=cuentas", permanent: true },
      { source: "/admin/reclamos", destination: "/admin/reportes", permanent: true },
      { source: "/admin/solicitudes", destination: "/admin/reportes?tab=pedidos", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
