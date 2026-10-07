import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { rutaDePanel } from "@/features/auth/rutas";
import { getUsuarioActual } from "@/lib/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  if (await getUsuarioActual()) redirect(rutaDePanel(callbackUrl));

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-extrabold">Ingresá a tu cuenta</h1>
        <CardDescription>Seguí tus fletes, presupuestos y mensajes.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <p>
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="font-semibold text-primary underline-offset-4 hover:underline">
            Registrate
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
