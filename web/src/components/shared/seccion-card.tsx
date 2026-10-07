import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

/** Bloque titulado de una página de configuración (perfil del cliente y del fletero). */
export function SeccionCard({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-32">
      <CardHeader>
        <h2 className="text-xl font-bold">{titulo}</h2>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
