import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { rutaDePanel } from "@/features/auth/rutas";
import { getUsuarioActual } from "@/lib/session";

export const metadata: Metadata = { title: "Ingresar" };

/** Avisos que llegan por URL después de un cambio de credenciales. Valores desconocidos se ignoran. */
const AVISOS: Record<string, string> = {
  contrasena: "Cambiaste tu contraseña y cerramos tus sesiones. Ingresá con la nueva.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; aviso?: string }>;
}) {
  const { callbackUrl, aviso } = await searchParams;
  if (await getUsuarioActual()) redirect(rutaDePanel(callbackUrl));
  const textoAviso = aviso ? AVISOS[aviso] : undefined;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-extrabold">Ingresá a tu cuenta</h1>
        <CardDescription>Seguí tus fletes, presupuestos y mensajes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {textoAviso ? (
          <Alert variant="success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <p>{textoAviso}</p>
          </Alert>
        ) : null}
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
