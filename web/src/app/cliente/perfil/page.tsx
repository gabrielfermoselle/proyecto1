import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SeccionCard } from "@/components/shared/seccion-card";
import { CambiarContrasenaForm } from "@/features/auth/components/cambiar-contrasena-form";
import { DatosClienteForm } from "@/features/clientes/perfil/components/datos-cliente-form";
import { DireccionHabitualForm } from "@/features/clientes/perfil/components/direccion-habitual-form";
import { getPerfilCliente } from "@/features/clientes/perfil/queries";
import { requireCliente } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PerfilClientePage() {
  const { clienteId } = await requireCliente();
  const perfil = await getPerfilCliente(clienteId);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Mi perfil" description={`Entrás con ${perfil.email}.`} />
      <SeccionCard
        id="datos"
        titulo="Tus datos"
        descripcion="Los fleteros ven tu nombre y la inicial de tu apellido."
      >
        <DatosClienteForm inicial={perfil.datos} />
      </SeccionCard>
      <SeccionCard
        id="direccion"
        titulo="Dirección habitual"
        descripcion="Desde acá medimos la distancia a cada fletero en el buscador."
      >
        <DireccionHabitualForm inicial={perfil.direccion} />
      </SeccionCard>
      <SeccionCard
        id="contrasena"
        titulo="Contraseña"
        descripcion="Al cambiarla cerramos tu sesión en todos los dispositivos."
      >
        <CambiarContrasenaForm />
      </SeccionCard>
    </div>
  );
}
