// [FUERA-S3] [FE] Panel de administración. Fuera de los sprints 1-3: el código original queda comentado abajo.
import { notFound } from "next/navigation";

export default function Page() {
  notFound();
}

// import { redirect } from "next/navigation";
// import { requireRol } from "@/lib/session";
//
// /** El panel arranca en la verificación de fleteros. */
// export default async function AdminInicioPage() {
//   await requireRol("ADMIN");
//   redirect("/admin/fleteros");
// }
