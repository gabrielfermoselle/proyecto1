import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { resetDB } from "./db.js";

const hash = (p) => bcrypt.hashSync(p, 10);

// Coordenadas base: Montevideo, Uruguay.
const BASE = { lat: -34.9011, lng: -56.1645 };

function around(dLat, dLng) {
  return { lat: BASE.lat + dLat, lng: BASE.lng + dLng };
}

const users = [];
const plumbers = [];
const jobs = [];
const reviews = [];

function makeUser(role, name, email, phone) {
  const u = {
    id: nanoid(10),
    role,
    name,
    email,
    passwordHash: hash("123456"),
    phone,
    createdAt: new Date().toISOString()
  };
  users.push(u);
  return u;
}

function makePlumber(user, data) {
  const p = {
    id: nanoid(10),
    userId: user.id,
    radioTrabajoKm: 10,
    portfolio: [],
    fotoUrl: "",
    descripcion: "",
    hourlyRate: 0,
    address: "",
    disponible: true,
    createdAt: new Date().toISOString(),
    ...data
  };
  plumbers.push(p);
  return p;
}

// --- Clientes ---
const ana = makeUser("client", "Ana Pereyra", "ana@demo.com", "099111222");
const luis = makeUser("client", "Luis Gómez", "luis@demo.com", "099333444");

// --- Plomeros ---
const carlosU = makeUser("plomero", "Carlos Rodríguez", "carlos@demo.com", "091000001");
const { lat: carlosLat, lng: carlosLng } = around(0.004, 0.006);
const carlos = makePlumber(carlosU, {
  especialidad: ["Plomería", "Gasista"],
  descripcion: "Plomero matriculado con 12 años de experiencia. Destapaciones, calefones y fugas.",
  hourlyRate: 850,
  latitud: carlosLat,
  longitud: carlosLng,
  address: "Cordón, Montevideo",
  radioTrabajoKm: 12,
  fotoUrl: "https://i.pravatar.cc/300?img=12",
  portfolio: [
    { title: "Instalación de calefón", imageUrl: "https://picsum.photos/seed/calefon/600/400", description: "Cambio de calefón a termotanque eléctrico." },
    { title: "Reparación de cañería", imageUrl: "https://picsum.photos/seed/caneria/600/400", description: "Fuga en cocina resuelta en el día." }
  ]
});

const martaU = makeUser("plomero", "Marta Silva", "marta@demo.com", "091000002");
const { lat: martaLat, lng: martaLng } = around(-0.008, 0.01);
const marta = makePlumber(martaU, {
  especialidad: ["Electricidad"],
  descripcion: "Electricista UTE habilitada. Tableros, cortocircuitos e instalaciones nuevas.",
  hourlyRate: 900,
  latitud: martaLat,
  longitud: martaLng,
  address: "Pocitos, Montevideo",
  radioTrabajoKm: 8,
  fotoUrl: "https://i.pravatar.cc/300?img=45",
  portfolio: [
    { title: "Tablero nuevo", imageUrl: "https://picsum.photos/seed/tablero/600/400", description: "Modernización de tablero con disyuntores." }
  ]
});

const joseU = makeUser("plomero", "José Fernández", "jose@demo.com", "091000003");
const { lat: joseLat, lng: joseLng } = around(0.02, -0.015);
const jose = makePlumber(joseU, {
  especialidad: ["Carpintería"],
  descripcion: "Carpintero de obra fina. Muebles a medida, placares y restauración.",
  hourlyRate: 700,
  latitud: joseLat,
  longitud: joseLng,
  address: "La Blanqueada, Montevideo",
  radioTrabajoKm: 15,
  fotoUrl: "https://i.pravatar.cc/300?img=33",
  portfolio: [
    { title: "Placard a medida", imageUrl: "https://picsum.photos/seed/placard/600/400", description: "Placard de melamina 3m." }
  ]
});

const soledadU = makeUser("plomero", "Soledad Castro", "sole@demo.com", "091000004");
const { lat: soleLat, lng: soleLng } = around(-0.03, -0.02);
const soledad = makePlumber(soledadU, {
  especialidad: ["Pintura", "Albañilería"],
  descripcion: "Pintora y albañil. Interiores, exteriores e impermeabilizaciones.",
  hourlyRate: 650,
  latitud: soleLat,
  longitud: soleLng,
  address: "Malvín, Montevideo",
  radioTrabajoKm: 20,
  fotoUrl: "https://i.pravatar.cc/300?img=20",
  portfolio: []
});

// --- Trabajos completados (para que las reseñas sean válidas) ---
function makeJob(client, plumber, title, description, status, price) {
  const job = {
    id: nanoid(10),
    clientId: client.id,
    plumberId: plumber.id,
    title,
    description,
    status,
    agreedPrice: price,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    completedAt: status === "completed" ? new Date().toISOString() : null
  };
  jobs.push(job);
  return job;
}

const j1 = makeJob(ana, carlos, "Arreglo de canilla", "Pérdida en el baño", "completed", 1500);
reviews.push({
  id: nanoid(10),
  jobId: j1.id,
  plumberId: carlos.id,
  clientId: ana.id,
  rating: 5,
  comment: "Excelente, puntual y prolijo. Súper recomendable.",
  createdAt: new Date().toISOString()
});

const j2 = makeJob(luis, carlos, "Destapación de cocina", "Cañería tapada", "completed", 2200);
reviews.push({
  id: nanoid(10),
  jobId: j2.id,
  plumberId: carlos.id,
  clientId: luis.id,
  rating: 4,
  comment: "Muy buen trabajo, resolvió rápido.",
  createdAt: new Date().toISOString()
});

const j3 = makeJob(ana, marta, "Cortocircuito en cocina", "Salta la térmica", "completed", 1800);
reviews.push({
  id: nanoid(10),
  jobId: j3.id,
  plumberId: marta.id,
  clientId: ana.id,
  rating: 5,
  comment: "Detectó el problema enseguida. Muy profesional.",
  createdAt: new Date().toISOString()
});

// Un trabajo en curso (para probar chat y flujo).
makeJob(luis, jose, "Placard para dormitorio", "Necesito presupuesto y medidas", "requested", null);

await resetDB({ users, plumbers, jobs, reviews, messages: [] });

console.log("Base de datos poblada con datos de demo.");
console.log("Usuarios de prueba (contraseña: 123456):");
console.log("  Cliente:  ana@demo.com");
console.log("  Cliente:  luis@demo.com");
console.log("  Plomero:  carlos@demo.com (Plomería)");
console.log("  Plomero:  marta@demo.com (Electricidad)");
console.log("  Plomero:  jose@demo.com (Carpintería)");
console.log("  Plomero:  sole@demo.com (Pintura)");
