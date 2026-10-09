import "server-only";
import type { TipoDocumento, TipoVehiculo } from "@/domain/catalogos";
import type { PerfilParaOnboarding } from "@/domain/onboarding";
import { urlPublica, urlsFirmadas } from "@/features/uploads/storage";
import { db, fallar, numero, relacion } from "@/lib/db";
import { configPublicaSupabase } from "@/lib/supabase";

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
  createdAt: string;
}

interface VehiculoFila {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  patente: string;
  capacidadKg: number;
  volumenM3: number | string;
  activo: boolean;
  createdAt: string;
  fotos: FotoFila[] | null;
}

interface PerfilFila {
  dni: string | null;
  bio: string | null;
  baseDireccion: string | null;
  baseLat: number | null;
  baseLng: number | null;
  radioCoberturaKm: number;
  precioMinimo: number | string;
  precioPorKm: number | string;
  precioPorM3: number | string;
  precioPorAyudante: number | string;
  disponible: boolean;
  onboardingCompletadoEn: string | null;
  user:
    | { nombre: string; apellido: string; telefono: string | null }
    | { nombre: string; apellido: string; telefono: string | null }[]
    | null;
  vehiculos: VehiculoFila[] | null;
}

/** Perfil completo del fletero para el onboarding y la página de perfil. Siempre por su `fleteroId`. */
export async function getPerfilFletero(fleteroId: string) {
  const { data, error } = await db()
    .from("perfiles_fletero")
    .select(
      `dni, bio, baseDireccion, baseLat, baseLng, radioCoberturaKm,
       precioMinimo, precioPorKm, precioPorM3, precioPorAyudante, disponible, onboardingCompletadoEn,
       user:usuarios!fletero_profiles_userId_fkey(nombre, apellido, telefono),
       vehiculos!vehiculos_fleteroId_fkey(id, tipo, marca, modelo, anio, patente, capacidadKg, volumenM3, activo, createdAt,
         fotos!fotos_vehiculoId_fkey(id, ruta, ancho, alto, createdAt))`,
    )
    .eq("id", fleteroId)
    .single();
  fallar(error);
  if (!data) throw new Error("No se encontró el registro");
  const perfil = data as PerfilFila;
  const user = relacion(perfil.user);
  if (!user) throw new Error("No se encontró el registro");

  const tarifas = {
    precioMinimo: numero(perfil.precioMinimo),
    precioPorKm: numero(perfil.precioPorKm),
    precioPorM3: numero(perfil.precioPorM3),
    precioPorAyudante: numero(perfil.precioPorAyudante),
  };
  const vehiculos = [...(perfil.vehiculos ?? [])]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((v) => ({
      id: v.id,
      tipo: v.tipo as TipoVehiculo,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      patente: v.patente,
      capacidadKg: v.capacidadKg,
      volumenM3: numero(v.volumenM3),
      activo: v.activo,
      fotos: [...(v.fotos ?? [])]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(({ id, ruta, ancho, alto }) => ({ id, ancho, alto, url: urlPublica(ruta) ?? "" })),
    }));

  const progreso: PerfilParaOnboarding = {
    dni: perfil.dni,
    telefono: user.telefono,
    vehiculosActivos: vehiculos.filter((v) => v.activo).length,
    baseLat: perfil.baseLat,
    baseLng: perfil.baseLng,
    precioMinimo: tarifas.precioMinimo,
    precioPorKm: tarifas.precioPorKm,
  };

  return {
    datos: {
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono ?? "",
      dni: perfil.dni ?? "",
      bio: perfil.bio ?? "",
    },
    zona: {
      baseDireccion: perfil.baseDireccion ?? "",
      baseLat: perfil.baseLat,
      baseLng: perfil.baseLng,
      radioCoberturaKm: perfil.radioCoberturaKm,
    },
    tarifas,
    vehiculos,
    disponible: perfil.disponible,
    onboardingCompleto: perfil.onboardingCompletadoEn !== null,
    /** Configuración para subir fotos desde el navegador; null si Storage no está configurado. */
    storage: configPublicaSupabase(),
    progreso,
  };
}

export type PerfilFletero = Awaited<ReturnType<typeof getPerfilFletero>>;
export type VehiculoPerfil = PerfilFletero["vehiculos"][number];

/** Documentos subidos para la verificación, con URLs firmadas (el bucket es privado). */
export async function getDocumentosFletero(fleteroId: string) {
  const [documentos, perfil] = await Promise.all([
    (async () => {
      const { data, error } = await db()
        .from("documentos_fletero")
        .select("tipo, ruta, createdAt")
        .eq("fleteroId", fleteroId);
      fallar(error);
      return (data ?? []) as { tipo: string; ruta: string; createdAt: string }[];
    })(),
    (async () => {
      const { data, error } = await db()
        .from("perfiles_fletero")
        .select("verificado")
        .eq("id", fleteroId)
        .single();
      fallar(error);
      if (!data) throw new Error("No se encontró el registro");
      return data as { verificado: boolean };
    })(),
  ]);
  const urls = await urlsFirmadas(documentos.map((d) => d.ruta));
  return {
    verificado: perfil.verificado,
    documentos: documentos.map((d) => ({
      tipo: d.tipo as TipoDocumento,
      subidoEn: new Date(d.createdAt),
      url: urls.get(d.ruta) ?? null,
    })),
  };
}

export type DocumentoSubido = Awaited<ReturnType<typeof getDocumentosFletero>>["documentos"][number];
