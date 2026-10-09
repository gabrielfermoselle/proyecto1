import { redirect } from "next/navigation";
import { requireRol } from "@/lib/session";

/** El panel arranca en la verificación de fleteros. */
export default async function AdminInicioPage() {
  await requireRol("ADMIN");
  redirect("/admin/fleteros");
}
