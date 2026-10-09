import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enlacesContacto } from "@/domain/contacto";

/**
 * WhatsApp y llamada a la otra parte. Solo se muestra con un flete confirmado: antes, todo va por
 * el chat de la plataforma.
 */
export function ContactoDirecto({
  nombre,
  telefono,
  mensaje,
}: {
  nombre: string;
  telefono: string | null;
  mensaje?: string;
}) {
  const enlaces = enlacesContacto(telefono, mensaje);
  if (!enlaces) {
    return (
      <p className="text-sm text-muted-foreground">
        {nombre} no cargó un teléfono. Coordiná por el chat de la plataforma.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Teléfono de {nombre}: <strong className="tabular-nums">{enlaces.visible}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <a href={enlaces.whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={enlaces.llamar}>
            <Phone aria-hidden="true" />
            Llamar
          </a>
        </Button>
      </div>
    </div>
  );
}
