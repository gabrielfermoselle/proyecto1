import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { ROLES_REGISTRABLES, type RolRegistrable } from "@/domain/roles";
import { RegistroForm } from "@/features/auth/components/registro-form";
import { rutaDePanel } from "@/features/auth/rutas";
import { getUsuarioActual } from "@/lib/session";

export const metadata: Metadata = { title: "Crear cuenta" };

const esRolRegistrable = (valor: string | undefined): valor is RolRegistrable =>
  (ROLES_REGISTRABLES as readonly string[]).includes(valor ?? "");

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  if (await getUsuarioActual()) redirect(rutaDePanel());
  const { rol } = await searchParams;
  const rolInicial = rol?.toUpperCase();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <h1 className="text-2xl font-extrabold">Creá tu cuenta</h1>
        <CardDescription>Es gratis y te lleva un minuto.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegistroForm rolInicial={esRolRegistrable(rolInicial) ? rolInicial : undefined} />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <p>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Ingresá
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
