import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SeccionCard } from "@/components/shared/seccion-card";
import { Button } from "@/components/ui/button";
// [FUERA-S3] [BE] Cambiar y recuperar contraseña
// import { CambiarContrasenaForm } from "@/features/auth/components/cambiar-contrasena-form";
// [FUERA-S3] [FE] Perfil del cliente
// import { DatosClienteForm } from "@/features/clientes/perfil/components/datos-cliente-form";
// [FUERA-S3] [FE] Perfil del cliente
// import { DireccionHabitualForm } from "@/features/clientes/perfil/components/direccion-habitual-form";
// [FUERA-S3] [FE] Perfil del cliente
// import { getPerfilCliente } from "@/features/clientes/perfil/queries";
import { DatosForm } from "@/features/fleteros/perfil/components/datos-form";
import { getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta" };

// [FUERA-S3] [BE] Cambiar y recuperar contraseña
// const SeccionContrasena = () => (
//   <SeccionCard
//     id="contrasena"
//     titulo="Contraseña"
//     descripcion="Al cambiarla cerramos tu sesión en todos los dispositivos."
//   >
//     <CambiarContrasenaForm />
//   </SeccionCard>
// );

/** La cuenta de cada rol en una sola página: datos personales, lo propio del rol y la contraseña. */
export default async function PerfilPage() {
  const usuario = await requireUsuario();

  // [FUERA-S3] [FE] Perfil del cliente: el cliente no tiene "Mi cuenta" en los sprints 1-3; vuelve a sus pedidos.
  if (usuario.clienteProfile) redirect("/cliente");
  // if (usuario.clienteProfile) {
  //   const perfil = await getPerfilCliente(usuario.clienteProfile.id);
  //   return (
  //     <div className="mx-auto grid max-w-3xl gap-6">
  //       <PageHeader title="Mi cuenta" description={`Entrás con ${perfil.email}.`} />
  //       <SeccionCard
  //         id="datos"
  //         titulo="Tus datos"
  //         descripcion="Los fleteros ven tu nombre y la inicial del apellido. Tu teléfono, solo el fletero que elijas."
  //       >
  //         <DatosClienteForm inicial={perfil.datos} />
  //       </SeccionCard>
  //       <SeccionCard
  //         id="direccion"
  //         titulo="Dirección habitual"
  //         descripcion="Desde acá medimos la distancia a cada fletero en el buscador."
  //       >
  //         <DireccionHabitualForm inicial={perfil.direccion} />
  //       </SeccionCard>
  //       <SeccionContrasena />
  //     </div>
  //   );
  // }

  if (usuario.fleteroProfile) {
    const fleteroId = usuario.fleteroProfile.id;
    const perfil = await getPerfilFletero(fleteroId);
    return (
      <div className="mx-auto grid max-w-3xl gap-6">
        <PageHeader
          title="Mi cuenta"
          description={`Entrás con ${usuario.email}.`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`/fleteros/${fleteroId}`}>
                Ver mi perfil público
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <Link
          href="/fletero/perfil"
          className="group flex items-center justify-between gap-4 rounded-xl bg-secondary p-5 text-secondary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="grid gap-0.5">
            {/* [FUERA-S3] [BE] Verificación de documentos: «Vehículos, zona, tarifas y documentos» */}
            <span className="font-heading text-lg font-extrabold">Vehículos, zona y tarifas</span>
            <span className="text-sm text-secondary-foreground/80">
              Lo que define qué pedidos ves y cómo se calcula tu precio sugerido.
            </span>
          </span>
          <ArrowRight
            className="size-5 shrink-0 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
        <SeccionCard
          id="datos"
          titulo="Tus datos"
          descripcion="Tu nombre y presentación se ven en tu perfil público. El teléfono, solo el cliente que te elija."
        >
          <DatosForm inicial={perfil.datos} />
        </SeccionCard>
        {/* [FUERA-S3] [BE] Cambiar y recuperar contraseña: <SeccionContrasena /> */}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Mi cuenta" description={`Entrás con ${usuario.email}.`} />
      {/* [FUERA-S3] [BE] Cambiar y recuperar contraseña: <SeccionContrasena /> */}
    </div>
  );
}
