// [FUERA-S3] [BE] Cambiar y recuperar contraseña. Fuera de los sprints 1-3: el código original queda comentado abajo.
import { notFound } from "next/navigation";

export default function Page() {
  notFound();
}

// import type { Metadata } from "next";
// import Link from "next/link";
// import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
// import { RecuperarForm } from "@/features/auth/components/recuperar-form";
//
// export const metadata: Metadata = { title: "Recuperar contraseña" };
//
// export default function RecuperarPage() {
//   return (
//     <Card className="w-full max-w-md">
//       <CardHeader>
//         <h1 className="text-2xl font-extrabold">¿Olvidaste tu contraseña?</h1>
//         <CardDescription>Te mandamos un link a tu email para que elijas una nueva.</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <RecuperarForm />
//       </CardContent>
//       <CardFooter className="justify-center text-sm">
//         <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
//           Volver a ingresar
//         </Link>
//       </CardFooter>
//     </Card>
//   );
// }
