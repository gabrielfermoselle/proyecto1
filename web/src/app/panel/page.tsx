import { redirect } from "next/navigation";
import { destinoSeguro } from "@/domain/roles";
import { requireUsuario } from "@/lib/session";

/** Distribuidor post-login: manda a cada rol a su área, validando el callbackUrl. */
export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const usuario = await requireUsuario();
  const { callbackUrl } = await searchParams;
  redirect(destinoSeguro(usuario.rol, callbackUrl));
}
