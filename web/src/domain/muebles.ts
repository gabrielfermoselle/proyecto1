// Medidas típicas de muebles y electrodomésticos. El cliente elige uno al cargar el inventario y
// se completan el tamaño y el peso; después los puede corregir.

export type TipoMueble = "Mueble" | "Electrodoméstico" | "Otro";

export interface MuebleEstandar {
  nombre: string;
  categoria: string;
  tipo: TipoMueble;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
  pesoKgAprox: number;
  /** Archivo de la miniatura en el bucket público `FotosCosas` de Supabase. */
  foto: string;
}

type Medidas = Omit<MuebleEstandar, "categoria" | "tipo" | "foto">;

const slug = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const grupo = (categoria: string, tipo: TipoMueble, muebles: Medidas[]): MuebleEstandar[] =>
  muebles.map((m) => ({ ...m, categoria, tipo, foto: `${slug(m.nombre)}.webp` }));

export const MUEBLES_ESTANDAR: readonly MuebleEstandar[] = [
  ...grupo("Cocina", "Electrodoméstico", [
    { nombre: "Heladera simple", largoCm: 60, anchoCm: 60, altoCm: 145, pesoKgAprox: 45 },
    {
      nombre: "Heladera doble",
      largoCm: 70,
      anchoCm: 70,
      altoCm: 180,
      pesoKgAprox: 70,
    },
    { nombre: "Heladera side by side", largoCm: 90, anchoCm: 75, altoCm: 180, pesoKgAprox: 110 },
    { nombre: "Frigobar", largoCm: 50, anchoCm: 50, altoCm: 85, pesoKgAprox: 25 },
    { nombre: "Freezer horizontal", largoCm: 100, anchoCm: 65, altoCm: 85, pesoKgAprox: 45 },
    { nombre: "Freezer vertical", largoCm: 60, anchoCm: 60, altoCm: 150, pesoKgAprox: 55 },
    { nombre: "Cocina", largoCm: 55, anchoCm: 60, altoCm: 85, pesoKgAprox: 40 },
    { nombre: "Anafe", largoCm: 60, anchoCm: 50, altoCm: 10, pesoKgAprox: 8 },
    { nombre: "Horno eléctrico", largoCm: 55, anchoCm: 40, altoCm: 35, pesoKgAprox: 10 },
    { nombre: "Microondas", largoCm: 50, anchoCm: 40, altoCm: 30, pesoKgAprox: 12 },
    { nombre: "Lavavajillas", largoCm: 60, anchoCm: 60, altoCm: 85, pesoKgAprox: 45 },
    { nombre: "Dispenser de agua", largoCm: 35, anchoCm: 35, altoCm: 100, pesoKgAprox: 15 },
  ]),
  ...grupo("Cocina", "Mueble", [
    { nombre: "Alacena", largoCm: 120, anchoCm: 35, altoCm: 60, pesoKgAprox: 25 },
    { nombre: "Bajo mesada", largoCm: 120, anchoCm: 60, altoCm: 85, pesoKgAprox: 40 },
    { nombre: "Mesa de cocina", largoCm: 120, anchoCm: 80, altoCm: 75, pesoKgAprox: 25 },
    { nombre: "Banqueta", largoCm: 40, anchoCm: 40, altoCm: 75, pesoKgAprox: 4 },
  ]),

  ...grupo("Living y comedor", "Mueble", [
    {
      nombre: "Mesa de comedor",
      largoCm: 160,
      anchoCm: 90,
      altoCm: 75,
      pesoKgAprox: 35,
    },
    { nombre: "Mesa redonda", largoCm: 110, anchoCm: 110, altoCm: 75, pesoKgAprox: 25 },
    { nombre: "Mesa ratona", largoCm: 100, anchoCm: 50, altoCm: 45, pesoKgAprox: 15 },
    { nombre: "Silla", largoCm: 45, anchoCm: 50, altoCm: 90, pesoKgAprox: 5 },
    { nombre: "Sillón de 1 cuerpo", largoCm: 85, anchoCm: 85, altoCm: 85, pesoKgAprox: 25 },
    { nombre: "Sillón de 2 cuerpos", largoCm: 150, anchoCm: 90, altoCm: 85, pesoKgAprox: 40 },
    {
      nombre: "Sillón de 3 cuerpos",
      largoCm: 200,
      anchoCm: 90,
      altoCm: 85,
      pesoKgAprox: 50,
    },
    { nombre: "Sillón esquinero", largoCm: 250, anchoCm: 200, altoCm: 85, pesoKgAprox: 80 },
    { nombre: "Sofá cama", largoCm: 190, anchoCm: 90, altoCm: 85, pesoKgAprox: 60 },
    { nombre: "Puff", largoCm: 45, anchoCm: 45, altoCm: 45, pesoKgAprox: 5 },
    { nombre: "Rack de TV", largoCm: 160, anchoCm: 40, altoCm: 55, pesoKgAprox: 30 },
    { nombre: "Aparador", largoCm: 160, anchoCm: 45, altoCm: 80, pesoKgAprox: 50 },
    { nombre: "Vajillero", largoCm: 100, anchoCm: 40, altoCm: 180, pesoKgAprox: 55 },
    { nombre: "Biblioteca", largoCm: 80, anchoCm: 30, altoCm: 180, pesoKgAprox: 35 },
    { nombre: "Estante", largoCm: 80, anchoCm: 25, altoCm: 5, pesoKgAprox: 3 },
    { nombre: "Piano vertical", largoCm: 150, anchoCm: 60, altoCm: 125, pesoKgAprox: 230 },
  ]),
  ...grupo("Living y comedor", "Electrodoméstico", [
    { nombre: 'Televisor de 32"', largoCm: 75, anchoCm: 10, altoCm: 45, pesoKgAprox: 6 },
    { nombre: 'Televisor de 50"', largoCm: 115, anchoCm: 10, altoCm: 70, pesoKgAprox: 15 },
    { nombre: 'Televisor de 65"', largoCm: 150, anchoCm: 10, altoCm: 90, pesoKgAprox: 25 },
    { nombre: "Equipo de música", largoCm: 50, anchoCm: 35, altoCm: 35, pesoKgAprox: 10 },
  ]),
  ...grupo("Living y comedor", "Otro", [
    { nombre: "Espejo grande", largoCm: 60, anchoCm: 5, altoCm: 160, pesoKgAprox: 12 },
    { nombre: "Cuadro", largoCm: 70, anchoCm: 5, altoCm: 50, pesoKgAprox: 3 },
    { nombre: "Alfombra", largoCm: 200, anchoCm: 30, altoCm: 30, pesoKgAprox: 10 },
    { nombre: "Lámpara de pie", largoCm: 40, anchoCm: 40, altoCm: 170, pesoKgAprox: 5 },
  ]),

  ...grupo("Dormitorio", "Mueble", [
    { nombre: "Cama de 1 plaza", largoCm: 190, anchoCm: 90, altoCm: 50, pesoKgAprox: 35 },
    {
      nombre: "Cama de 2 plazas",
      largoCm: 190,
      anchoCm: 140,
      altoCm: 50,
      pesoKgAprox: 60,
    },
    { nombre: "Cama queen", largoCm: 200, anchoCm: 160, altoCm: 50, pesoKgAprox: 70 },
    { nombre: "Cama king", largoCm: 200, anchoCm: 200, altoCm: 50, pesoKgAprox: 85 },
    { nombre: "Cucheta", largoCm: 190, anchoCm: 90, altoCm: 160, pesoKgAprox: 60 },
    { nombre: "Cuna", largoCm: 120, anchoCm: 65, altoCm: 95, pesoKgAprox: 20 },
    { nombre: "Colchón de 1 plaza", largoCm: 190, anchoCm: 80, altoCm: 20, pesoKgAprox: 12 },
    { nombre: "Colchón de 2 plazas", largoCm: 190, anchoCm: 140, altoCm: 25, pesoKgAprox: 25 },
    { nombre: "Colchón queen", largoCm: 200, anchoCm: 160, altoCm: 28, pesoKgAprox: 32 },
    { nombre: "Colchón king", largoCm: 200, anchoCm: 200, altoCm: 30, pesoKgAprox: 40 },
    { nombre: "Sommier de 2 plazas", largoCm: 190, anchoCm: 140, altoCm: 30, pesoKgAprox: 35 },
    { nombre: "Respaldo de cama", largoCm: 150, anchoCm: 8, altoCm: 110, pesoKgAprox: 15 },
    { nombre: "Mesa de luz", largoCm: 45, anchoCm: 35, altoCm: 55, pesoKgAprox: 10 },
    { nombre: "Placard de 2 puertas", largoCm: 100, anchoCm: 55, altoCm: 180, pesoKgAprox: 60 },
    { nombre: "Placard de 3 puertas", largoCm: 150, anchoCm: 55, altoCm: 200, pesoKgAprox: 90 },
    { nombre: "Ropero", largoCm: 120, anchoCm: 55, altoCm: 190, pesoKgAprox: 75 },
    { nombre: "Cómoda", largoCm: 90, anchoCm: 45, altoCm: 80, pesoKgAprox: 35 },
    { nombre: "Chifonier", largoCm: 60, anchoCm: 45, altoCm: 120, pesoKgAprox: 35 },
    { nombre: "Tocador", largoCm: 100, anchoCm: 45, altoCm: 140, pesoKgAprox: 30 },
    { nombre: "Zapatero", largoCm: 80, anchoCm: 30, altoCm: 100, pesoKgAprox: 15 },
  ]),

  ...grupo("Baño y lavadero", "Electrodoméstico", [
    {
      nombre: "Lavarropas",
      largoCm: 60,
      anchoCm: 60,
      altoCm: 85,
      pesoKgAprox: 65,
    },
    { nombre: "Secarropas", largoCm: 60, anchoCm: 60, altoCm: 85, pesoKgAprox: 35 },
    { nombre: "Termotanque", largoCm: 50, anchoCm: 50, altoCm: 120, pesoKgAprox: 40 },
  ]),
  ...grupo("Baño y lavadero", "Mueble", [
    { nombre: "Vanitory", largoCm: 80, anchoCm: 45, altoCm: 85, pesoKgAprox: 25 },
    { nombre: "Tender", largoCm: 150, anchoCm: 10, altoCm: 60, pesoKgAprox: 4 },
  ]),

  ...grupo("Oficina", "Mueble", [
    { nombre: "Escritorio", largoCm: 120, anchoCm: 60, altoCm: 75, pesoKgAprox: 25 },
    { nombre: "Silla de oficina", largoCm: 65, anchoCm: 65, altoCm: 110, pesoKgAprox: 12 },
    { nombre: "Archivero", largoCm: 45, anchoCm: 60, altoCm: 130, pesoKgAprox: 40 },
  ]),
  ...grupo("Oficina", "Electrodoméstico", [
    { nombre: "Computadora de escritorio", largoCm: 45, anchoCm: 20, altoCm: 45, pesoKgAprox: 10 },
    { nombre: "Monitor", largoCm: 60, anchoCm: 20, altoCm: 45, pesoKgAprox: 5 },
    { nombre: "Impresora", largoCm: 45, anchoCm: 35, altoCm: 25, pesoKgAprox: 8 },
  ]),

  ...grupo("Climatización", "Electrodoméstico", [
    { nombre: "Aire acondicionado split", largoCm: 90, anchoCm: 35, altoCm: 60, pesoKgAprox: 45 },
    { nombre: "Aire acondicionado portátil", largoCm: 45, anchoCm: 40, altoCm: 80, pesoKgAprox: 30 },
    { nombre: "Ventilador de pie", largoCm: 50, anchoCm: 50, altoCm: 130, pesoKgAprox: 5 },
    { nombre: "Estufa", largoCm: 60, anchoCm: 30, altoCm: 70, pesoKgAprox: 15 },
    { nombre: "Caloventor", largoCm: 30, anchoCm: 20, altoCm: 30, pesoKgAprox: 3 },
  ]),

  ...grupo("Exterior y gimnasio", "Mueble", [
    { nombre: "Mesa de jardín", largoCm: 150, anchoCm: 90, altoCm: 75, pesoKgAprox: 20 },
    { nombre: "Reposera", largoCm: 180, anchoCm: 65, altoCm: 35, pesoKgAprox: 8 },
  ]),
  ...grupo("Exterior y gimnasio", "Otro", [
    { nombre: "Bicicleta", largoCm: 180, anchoCm: 60, altoCm: 100, pesoKgAprox: 15 },
    { nombre: "Moto", largoCm: 200, anchoCm: 75, altoCm: 110, pesoKgAprox: 110 },
    { nombre: "Parrilla", largoCm: 100, anchoCm: 60, altoCm: 100, pesoKgAprox: 40 },
    { nombre: "Cortadora de césped", largoCm: 100, anchoCm: 50, altoCm: 100, pesoKgAprox: 30 },
    { nombre: "Cinta de correr", largoCm: 180, anchoCm: 80, altoCm: 140, pesoKgAprox: 90 },
    { nombre: "Bicicleta fija", largoCm: 100, anchoCm: 55, altoCm: 130, pesoKgAprox: 35 },
    { nombre: "Planta grande con maceta", largoCm: 50, anchoCm: 50, altoCm: 150, pesoKgAprox: 30 },
    { nombre: "Caja de herramientas", largoCm: 50, anchoCm: 25, altoCm: 25, pesoKgAprox: 12 },
  ]),

  ...grupo("Cajas y bultos", "Otro", [
    { nombre: "Caja de mudanza chica", largoCm: 40, anchoCm: 30, altoCm: 30, pesoKgAprox: 8 },
    { nombre: "Caja de mudanza", largoCm: 50, anchoCm: 40, altoCm: 40, pesoKgAprox: 12 },
    { nombre: "Caja de mudanza grande", largoCm: 60, anchoCm: 50, altoCm: 50, pesoKgAprox: 18 },
    { nombre: "Valija", largoCm: 70, anchoCm: 45, altoCm: 30, pesoKgAprox: 20 },
    { nombre: "Bolso de ropa", largoCm: 70, anchoCm: 40, altoCm: 40, pesoKgAprox: 10 },
  ]),
];

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const singular = (palabra: string) =>
  palabra.length > 4 && palabra.endsWith("s") ? palabra.replace(/e?s$/, "") : palabra;

/** El mueble con ese nombre exacto (sin distinguir mayúsculas, acentos ni espacios de más). */
export function buscarMueble(nombre: string): MuebleEstandar | null {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  return MUEBLES_ESTANDAR.find((m) => normalizar(m.nombre) === buscado) ?? null;
}

/**
 * Los muebles cuyo nombre contiene lo escrito, seguidos de los que coinciden por tipo o ambiente
 * ("muebles", "electrodomésticos", "cocina"…). Vacío si no se escribió nada.
 */
export function sugerirMuebles(texto: string): MuebleEstandar[] {
  const buscado = normalizar(texto);
  if (!buscado) return [];
  const porNombre = MUEBLES_ESTANDAR.filter((m) => normalizar(m.nombre).includes(buscado));
  const palabras = buscado.split(" ").map(singular);
  const porGrupo = MUEBLES_ESTANDAR.filter((m) => {
    if (porNombre.includes(m)) return false;
    const grupoNormalizado = normalizar(`${m.tipo} ${m.categoria}`);
    return palabras.every((p) => grupoNormalizado.includes(p));
  });
  return [...porNombre, ...porGrupo];
}
