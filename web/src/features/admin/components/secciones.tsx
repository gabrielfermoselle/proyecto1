import { BadgeCheck, FileImage, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ETIQUETA_DOCUMENTO,
  ETIQUETA_ETAPA,
  ETIQUETA_RESULTADO,
  ETIQUETA_VEHICULO,
  TIPOS_DOCUMENTO,
} from "@/domain/catalogos";
import { formatearDia, formatearFecha, formatearFechaHora, formatearRating } from "@/lib/formato";
import {
  getFleterosParaVerificar,
  getReclamos,
  getSolicitudesAdmin,
  getUsuarios,
  ROLES_FILTRO,
} from "../queries";
import { BotonEstadoUsuario, BotonVerificar, FormResolverReclamo } from "./acciones-admin";

// Secciones del panel de administración: verificación de fleteros, cuentas, denuncias y pedidos.

export async function VerificacionFleteros({ verificados }: { verificados: boolean }) {
  const fleteros = await getFleterosParaVerificar(verificados);
  if (fleteros.length === 0) {
    return (
      <EmptyState
        icon={<BadgeCheck />}
        title={verificados ? "Todavía no verificaste a nadie" : "No hay fleteros esperando verificación"}
        description="Aparecen acá cuando completan el perfil."
      />
    );
  }
  return (
    <ul className="grid gap-4">
      {fleteros.map((f) => {
        const completos = TIPOS_DOCUMENTO.every((t) => f.documentos.some((d) => d.tipo === t));
        return (
          <li key={f.id} className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{f.nombre}</span>
                  {f.verificado ? (
                    <Badge variant="success">
                      <BadgeCheck aria-hidden="true" />
                      Verificado
                    </Badge>
                  ) : completos ? (
                    <Badge variant="warning">Documentación completa</Badge>
                  ) : (
                    <Badge variant="muted">
                      {f.documentos.length} de {TIPOS_DOCUMENTO.length} documentos
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {f.email}
                  {f.telefono ? ` · ${f.telefono}` : ""}
                  {f.dni ? ` · DNI ${f.dni}` : ""}
                  {f.alta ? ` · perfil completo el ${formatearFecha(f.alta)}` : ""}
                </p>
                <p className="text-sm">
                  {f.vehiculos
                    .map((v) => `${ETIQUETA_VEHICULO[v.tipo]} ${v.marca} ${v.modelo} (${v.patente})`)
                    .join(" · ") || "Sin vehículos activos"}
                  {f.rating !== null ? ` · ${formatearRating(f.rating)} ★ (${f.calificaciones})` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/fleteros/${f.id}`}>Perfil público</Link>
                </Button>
                <BotonVerificar fleteroId={f.id} verificado={f.verificado} />
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={`Documentos de ${f.nombre}`}>
              {TIPOS_DOCUMENTO.map((t) => {
                const d = f.documentos.find((x) => x.tipo === t);
                return (
                  <li key={t} className="grid gap-1.5">
                    {d?.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Image
                          src={d.url}
                          alt={`${ETIQUETA_DOCUMENTO[t]} de ${f.nombre}`}
                          width={240}
                          height={150}
                          className="aspect-[16/10] w-full object-cover transition-transform hover:scale-105"
                        />
                      </a>
                    ) : (
                      <span className="grid h-16 place-items-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                        <FileImage className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="text-xs">
                      <span className="font-semibold">{ETIQUETA_DOCUMENTO[t]}</span>
                      <span className="block text-muted-foreground">
                        {d ? `Subido el ${formatearFecha(d.subidoEn)}` : "Falta"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

const ETIQUETA_ROL = { CLIENTE: "Cliente", FLETERO: "Fletero", ADMIN: "Admin" } as const;

export async function Cuentas({
  q,
  rolParam,
  paginaParam,
  yoId,
}: {
  q: string | undefined;
  rolParam: string | undefined;
  paginaParam: string | undefined;
  yoId: string;
}) {
  // Los filtros llegan por URL: se validan, nunca se usan tal cual.
  const rol = (ROLES_FILTRO as readonly string[]).includes(rolParam ?? "")
    ? (rolParam as (typeof ROLES_FILTRO)[number])
    : null;
  const pagina = Math.min(500, Math.max(1, Number.parseInt(paginaParam ?? "1", 10) || 1));
  const texto = (q ?? "").slice(0, 100);
  const { usuarios, total, paginas } = await getUsuarios({ q: texto, rol, pagina });
  const enlace = (p: number) =>
    `/admin/fleteros?${new URLSearchParams({ tab: "cuentas", ...(texto ? { q: texto } : {}), ...(rol ? { rol } : {}), pagina: String(p) })}`;

  return (
    <div className="grid gap-4">
      <form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <input type="hidden" name="tab" value="cuentas" />
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
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "cuenta" : "cuentas"}
      </p>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-3 sm:px-4">
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
            {u.rol !== "ADMIN" && u.id !== yoId ? (
              <BotonEstadoUsuario userId={u.id} nombre={u.nombre} activo={u.activo} />
            ) : null}
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

const FASE = { CARGA: "Al cargar", DESCARGA: "Al descargar", RECEPCION: "Al recibir" } as const;

export async function Denuncias({ resueltas }: { resueltas: boolean }) {
  const estado = resueltas ? "RESUELTO" : "ABIERTO";
  const reclamos = await getReclamos(estado);
  if (reclamos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        {resueltas ? "Todavía no se resolvió ninguna denuncia." : "No hay denuncias abiertas."}
      </p>
    );
  }
  return (
    <ul className="grid gap-4">
      {reclamos.map((r) => (
        <li key={r.id} className="grid gap-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="grid gap-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{r.item}</span>
              <span className="text-muted-foreground">en «{r.titulo}»</span>
              <time dateTime={r.fecha.toISOString()} className="text-sm text-muted-foreground">
                {formatearFechaHora(r.fecha)}
              </time>
            </p>
            <p className="text-sm text-muted-foreground">
              Cliente: {r.cliente.nombre} ({r.cliente.email}) · Fletero: {r.fletero.nombre} ({r.fletero.email}
              )
            </p>
          </div>
          <p className="rounded-lg bg-destructive/10 p-3 text-sm">«{r.descripcion}»</p>
          {r.fotos.length > 0 ? <GaleriaFotos fotos={r.fotos} descripcion={`Reclamo por ${r.item}`} /> : null}
          {r.controles.length > 0 ? (
            <ul className="grid gap-1 text-sm" aria-label="Lo registrado sobre este ítem">
              {r.controles.map((c) => (
                <li key={c.fase} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-muted-foreground">{FASE[c.fase]}:</span>
                  <Badge variant="outline">{ETIQUETA_RESULTADO[c.resultado]}</Badge>
                  {c.observacion ? <span>«{c.observacion}»</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {r.estado === "ABIERTO" ? (
            <FormResolverReclamo reclamoId={r.id} />
          ) : (
            <div className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">
                Resuelto{r.resueltoPor ? ` por ${r.resueltoPor}` : ""}
                {r.resueltoEn ? ` el ${formatearFechaHora(r.resueltoEn)}` : ""}
              </p>
              <p>{r.resolucion}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const ESTADO_SOLICITUD = {
  ABIERTA: "Abierta",
  ADJUDICADA: "Con flete",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
} as const;

export async function Pedidos() {
  const solicitudes = await getSolicitudesAdmin();
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabla de pedidos"
      className="overflow-x-auto rounded-xl border bg-card shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="p-3">
              Pedido
            </th>
            <th scope="col" className="p-3">
              Cliente
            </th>
            <th scope="col" className="p-3">
              Para el
            </th>
            <th scope="col" className="p-3">
              Presupuestos
            </th>
            <th scope="col" className="p-3">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-3">
                <span className="font-semibold">{s.titulo}</span>
                <span className="block text-muted-foreground">publicado {formatearFecha(s.publicada)}</span>
              </td>
              <td className="p-3">{s.cliente}</td>
              <td className="p-3">{formatearDia(s.fecha)}</td>
              <td className="p-3 tabular-nums">{s.presupuestos}</td>
              <td className="p-3">
                <Badge
                  variant={
                    s.estado === "ABIERTA" ? "default" : s.estado === "ADJUDICADA" ? "success" : "muted"
                  }
                >
                  {s.flete ? ETIQUETA_ETAPA[s.flete.etapa] : ESTADO_SOLICITUD[s.estado]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
