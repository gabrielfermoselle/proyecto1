"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ sobreToldo = false }: { sobreToldo?: boolean }) {
  const [saliendo, setSaliendo] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={saliendo}
      className={cn(sobreToldo && "hover:bg-white/10 focus-visible:ring-accent focus-visible:ring-offset-0")}
      onClick={() => {
        setSaliendo(true);
        void signOut({ callbackUrl: "/login" });
      }}
    >
      <LogOut aria-hidden="true" />
      <span className="sr-only xl:not-sr-only">{saliendo ? "Saliendo…" : "Salir"}</span>
    </Button>
  );
}
