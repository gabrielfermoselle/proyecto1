import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BotonEstadoUsuario, BotonVerificar } from "@/features/admin/components/acciones-admin";
import { getUsuarios, ROLES_FILTRO } from "@/features/admin/queries";
import { formatearFecha, formatearRating } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Usuarios" };

const ETIQUETA_ROL = { CLIENTE: "Cliente", FLETERO: "Fletero", ADMIN: "Admin" } as const;

type Props = { searchParams: Promise<{ q?: string; rol?: string; pagina?: string }> };

export default async function UsuariosPage({ searchParams }: Props) {
  const yo = await requireRol("ADMIN");
  const q = await searchParams;
  // Los filtros llegan por URL: se validan, nunca se usan tal cual.
  const rol = (ROLES_FILTRO as readonly string[]).includes(q.rol ?? "")
    ? (q.rol as (typeof ROLES_FILTRO)[number])
    : null;
  const pagina = Math.min(500, Math.max(1, Number.parseInt(q.pagina ?? "1", 10) || 1));
  const texto = (q.q ?? "").slice(0, 100);
  const { usuarios, total, paginas } = await getUsuarios({ q: texto, rol, pagina });
  const enlace = (p: number) =>
    `/admin/usuarios?${new URLSearchParams({ ...(texto ? { q: texto } : {}), ...(rol ? { rol } : {}), pagina: String(p) })}`;

  return (
    <div className="grid gap-6">
      <PageHeader title="Usuarios" description={`${total} ${total === 1 ? "cuenta" : "cuentas"}.`} />
      <form
        method="get"
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="q">Nombre o email</Label>
          <Input id="q" name="q" defaultValue={texto} placeholder="Ej.: ana@" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rol">Rol</Label>
          <Select id="rol" name="rol" defaultValue={rol ?? ""}>
            <option value="">Todos</option>
            {ROLES_FILTRO.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

      <ul className="grid gap-2">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{u.nombre}</span>
                <Badge variant="outline">{ETIQUETA_ROL[u.rol]}</Badge>
                {!u.activo ? <Badge variant="destructive">Desactivada</Badge> : null}
                {u.fletero?.verificado ? <Badge variant="success">Verificado</Badge> : null}
                {u.fletero && !u.fletero.onboardingCompleto ? (
                  <Badge variant="muted">Perfil incompleto</Badge>
                ) : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {u.email} · alta {formatearFecha(u.alta)}
                {u.fletero && u.fletero.rating !== null
                  ? ` · ${formatearRating(u.fletero.rating)} ★ (${u.fletero.calificaciones})`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {u.fletero?.onboardingCompleto ? (
                <>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/fleteros/${u.fletero.id}`}>Perfil</Link>
                  </Button>
                  <BotonVerificar fleteroId={u.fletero.id} verificado={u.fletero.verificado} />
                </>
              ) : null}
              {u.rol !== "ADMIN" && u.id !== yo.id ? (
                <BotonEstadoUsuario userId={u.id} nombre={u.nombre} activo={u.activo} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-3">
          {pagina > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={enlace(pagina - 1)}>Anterior</Link>
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Button asChild variant="outline" size="sm">
              <Link href={enlace(pagina + 1)}>Siguiente</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
