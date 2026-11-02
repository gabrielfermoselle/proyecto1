import { getBandeja } from "@/features/chat/queries";
import { json, noAutenticado } from "@/lib/api";
import { getUsuarioActual } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await getUsuarioActual();
  if (!usuario) return noAutenticado();
  return json(await getBandeja(usuario));
}
