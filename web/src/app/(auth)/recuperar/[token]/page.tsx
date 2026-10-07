import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { RestablecerForm } from "@/features/auth/components/restablecer-form";

export const metadata: Metadata = { title: "Elegí una contraseña nueva", referrer: "no-referrer" };

/**
 * El token se valida recién al guardar (una sola consulta, dentro de la transacción). La página
 * no lo envía a terceros: sin referrer, el link no queda en los logs de otros sitios.
 */
export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-extrabold">Elegí una contraseña nueva</h1>
        <CardDescription>Al guardarla cerramos tu sesión en todos los dispositivos.</CardDescription>
      </CardHeader>
      <CardContent>
        <RestablecerForm token={token} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/recuperar" className="font-semibold text-primary underline-offset-4 hover:underline">
          Pedir otro link
        </Link>
      </CardFooter>
    </Card>
  );
}
