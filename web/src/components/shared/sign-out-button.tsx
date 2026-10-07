"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [saliendo, setSaliendo] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={saliendo}
      onClick={() => {
        setSaliendo(true);
        void signOut({ callbackUrl: "/login" });
      }}
    >
      <LogOut aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{saliendo ? "Saliendo…" : "Salir"}</span>
    </Button>
  );
}
