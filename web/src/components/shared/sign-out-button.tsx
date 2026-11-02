"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Cerrar sesión pide confirmación: el botón está en el toldo, al lado de la navegación, y un
 * toque de más no tiene que sacar a nadie de la cuenta.
 */
export function SignOutButton({ sobreToldo = false }: { sobreToldo?: boolean }) {
  return (
    <ConfirmDialog
      title="¿Cerrar sesión?"
      description="Vas a tener que ingresar de nuevo con tu email y tu contraseña."
      confirmLabel="Cerrar sesión"
      onConfirm={async () => {
        await signOut({ callbackUrl: "/login" });
        // signOut redirige: el diálogo queda en «Un momento…» hasta que cambia la página.
        return false;
      }}
      trigger={(abrir) => (
        <Button
          variant="ghost"
          size="sm"
          className={cn(sobreToldo && "hover:bg-white/10 focus-visible:ring-accent-on-dark focus-visible:ring-offset-0")}
          onClick={abrir}
        >
          <LogOut aria-hidden="true" />
          <span className="sr-only xl:not-sr-only">Salir</span>
        </Button>
      )}
    />
  );
}
