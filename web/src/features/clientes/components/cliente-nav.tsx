"use client";

import { ClipboardList, MessagesSquare, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { Button } from "@/components/ui/button";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

const secciones = (): SeccionNav[] => [
  {
    href: "/cliente",
    label: "Mis pedidos",
    labelCorto: "Pedidos",
    Icono: ClipboardList,
    prefijos: ["/cliente/pedido"],
    enInferior: true,
  },
  {
    href: "/cliente/fleteros",
    label: "Fleteros",
    Icono: Search,
    prefijos: ["/cliente/fleteros"],
    enInferior: true,
  },
  {
    href: "/cliente/nuevo",
    label: "Nuevo pedido",
    labelCorto: "Nuevo",
    Icono: Plus,
    prefijos: [],
    enInferior: true,
    enSuperior: false,
    destacada: true,
  },
  {
    href: "/chat",
    label: "Chat",
    Icono: MessagesSquare,
    prefijos: ["/chat"],
    enInferior: true,
    extra: <NoLeidosBadge />,
  },
  {
    href: "/perfil",
    label: "Perfil",
    Icono: UserRound,
    prefijos: [],
    enInferior: true,
    enSuperior: false,
  },
];

export function ClienteNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function ClienteNavInferior() {
  return <NavInferior secciones={secciones()} ocultarEn={/^\/chat\/[^/]+/} />;
}

export function BotonNuevoPedido() {
  return (
    <Button asChild variant="accent" size="sm">
      <Link href="/cliente/nuevo">
        <Plus aria-hidden="true" />
        Nuevo pedido
      </Link>
    </Button>
  );
}
