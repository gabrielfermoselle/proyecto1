// [FUERA-S3] [BE] Chat en tiempo real. Fuera de los sprints 1-3: el código original queda comentado abajo.
export function GET() {
  return new Response(null, { status: 404 });
}

// import { getBandeja } from "@/features/chat/queries";
// import { json, noAutenticado } from "@/lib/api";
// import { getUsuarioActual } from "@/lib/session";
//
// export const dynamic = "force-dynamic";
//
// export async function GET() {
//   const usuario = await getUsuarioActual();
//   if (!usuario) return noAutenticado();
//   return json(await getBandeja(usuario));
// }
