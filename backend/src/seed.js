import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { resetDB } from "./db.js";

// Datos de demo en el Gran San Miguel de Tucumán.
const hash = (p) => bcrypt.hashSync(p, 10);
const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
const en = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

const LUGARES = {
  centro: { direccion: "Plaza Independencia, San Miguel de Tucumán", lat: -26.8303, lng: -65.2038 },
  barrioNorte: { direccion: "Barrio Norte, San Miguel de Tucumán", lat: -26.8185, lng: -65.2105 },
  barrioSur: { direccion: "Barrio Sur, San Miguel de Tucumán", lat: -26.8405, lng: -65.2062 },
  yerbaBuena: { direccion: "Av. Aconquija, Yerba Buena", lat: -26.8163, lng: -65.2851 },
  taficito: { direccion: "Centro, Tafí Viejo", lat: -26.7322, lng: -65.2594 },
  banda: { direccion: "Banda del Río Salí", lat: -26.8433, lng: -65.1667 },
  mercado: { direccion: "Mercado de Abasto, San Miguel de Tucumán", lat: -26.8465, lng: -65.2291 }
};

const usuarios = [];
const fleteros = [];
const solicitudes = [];
const presupuestos = [];
const resenas = [];

function makeUsuario(rol, nombre, correo, telefono) {
  const u = {
    id: nanoid(10),
    rol,
    nombre,
    correo,
    hashContrasena: hash("123456"),
    telefono,
    creadoEn: hace(60)
  };
  usuarios.push(u);
  return u;
}

function makeFletero(usuario, lugar, data) {
  const f = {
    id: nanoid(10),
    usuarioId: usuario.id,
    vehiculoDescripcion: "",
    capacidadKg: null,
    descripcion: "",
    tarifaBase: 0,
    direccion: lugar.direccion,
    latitud: lugar.lat,
    longitud: lugar.lng,
    radioTrabajoKm: 15,
    fotoUrl: "",
    fotoVehiculoUrl: "",
    disponible: true,
    creadoEn: hace(60),
    ...data
  };
  fleteros.push(f);
  return f;
}

function item(nombre, cantidad, estado = {}) {
  return {
    id: nanoid(8),
    nombre,
    cantidad,
    fotoUrl: "",
    cargado: false,
    cargadoEn: null,
    entregado: false,
    entregadoEn: null,
    ...estado
  };
}

function makeSolicitud(cliente, origen, destino, data) {
  const s = {
    id: nanoid(10),
    clienteId: cliente.id,
    titulo: "",
    tipoCarga: "otro",
    descripcion: "",
    origenDireccion: origen.direccion,
    origenLat: origen.lat,
    origenLng: origen.lng,
    destinoDireccion: destino.direccion,
    destinoLat: destino.lat,
    destinoLng: destino.lng,
    fecha: en(3),
    tipoVehiculo: null,
    fotos: [],
    inventario: [],
    estado: "publicada",
    fleteroId: null,
    presupuestoId: null,
    precioAcordado: null,
    historial: [{ estado: "publicada", fecha: hace(5), usuarioId: cliente.id }],
    creadoEn: hace(5),
    completadaEn: null,
    ...data
  };
  solicitudes.push(s);
  return s;
}

function makePresupuesto(solicitud, fletero, monto, mensaje, estado = "pendiente") {
  const p = {
    id: nanoid(10),
    solicitudId: solicitud.id,
    fleteroId: fletero.id,
    monto,
    mensaje,
    estado,
    creadoEn: hace(4)
  };
  presupuestos.push(p);
  return p;
}

function asignar(solicitud, presupuesto) {
  solicitud.fleteroId = presupuesto.fleteroId;
  solicitud.presupuestoId = presupuesto.id;
  solicitud.precioAcordado = presupuesto.monto;
  presupuesto.estado = "aceptado";
}

// --- Clientes ---
const ana = makeUsuario("cliente", "Ana Pereyra", "ana@demo.com", "381 411 2222");
const luis = makeUsuario("cliente", "Luis Gómez", "luis@demo.com", "381 433 4444");

// --- Fleteros (uno por tipo de vehículo) ---
const carlos = makeFletero(makeUsuario("fletero", "Carlos Rodríguez", "carlos@demo.com", "381 500 0001"), LUGARES.barrioNorte, {
  tipoVehiculo: "camioneta",
  vehiculoDescripcion: "Ford Ranger con caja abierta",
  capacidadKg: 1000,
  descripcion: "Fletes y mudanzas chicas en toda la capital. Llevo mantas y sogas.",
  tarifaBase: 15000,
  radioTrabajoKm: 20
});
const marta = makeFletero(makeUsuario("fletero", "Marta Silva", "marta@demo.com", "381 500 0002"), LUGARES.centro, {
  tipoVehiculo: "moto",
  vehiculoDescripcion: "Honda Wave con baúl",
  capacidadKg: 20,
  descripcion: "Envíos de paquetes y compras chicas en el día.",
  tarifaBase: 3000,
  radioTrabajoKm: 10
});
const jose = makeFletero(makeUsuario("fletero", "José Fernández", "jose@demo.com", "381 500 0003"), LUGARES.banda, {
  tipoVehiculo: "camion",
  vehiculoDescripcion: "Camión mediano con furgón cerrado",
  capacidadKg: 5000,
  descripcion: "Mudanzas completas con ayudantes. Todo el Gran Tucumán.",
  tarifaBase: 60000,
  radioTrabajoKm: 40
});
const sole = makeFletero(makeUsuario("fletero", "Soledad Castro", "sole@demo.com", "381 500 0004"), LUGARES.yerbaBuena, {
  tipoVehiculo: "auto",
  vehiculoDescripcion: "Renault Kangoo",
  capacidadKg: 500,
  descripcion: "Traslados de muebles chicos y compras grandes. Zona Yerba Buena y capital.",
  tarifaBase: 8000,
  radioTrabajoKm: 15
});

// --- Solicitud completada y calificada (reputación real) ---
const s1 = makeSolicitud(ana, LUGARES.barrioSur, LUGARES.yerbaBuena, {
  titulo: "Mudanza de monoambiente",
  tipoCarga: "mudanza",
  descripcion: "Primer piso por escalera. Nada frágil salvo el televisor.",
  fecha: hace(10),
  tipoVehiculo: "camioneta",
  estado: "completada",
  creadoEn: hace(14),
  completadaEn: hace(10),
  inventario: [
    item("Cama de una plaza", 1, { cargado: true, cargadoEn: hace(10), entregado: true, entregadoEn: hace(10) }),
    item("Cajas", 8, { cargado: true, cargadoEn: hace(10), entregado: true, entregadoEn: hace(10) }),
    item("Televisor 40\"", 1, { cargado: true, cargadoEn: hace(10), entregado: true, entregadoEn: hace(10) })
  ]
});
asignar(s1, makePresupuesto(s1, carlos, 18000, "Lo hago el sábado a la mañana."));
makePresupuesto(s1, jose, 45000, "Voy con un ayudante.", "rechazado");
s1.historial = ["publicada", "confirmada", "en_transito", "entregada", "completada"].map((estado, i) => ({
  estado,
  fecha: hace(14 - i),
  usuarioId: ["confirmada", "completada", "publicada"].includes(estado) ? ana.id : carlos.usuarioId
}));
resenas.push({
  id: nanoid(10),
  solicitudId: s1.id,
  fleteroId: carlos.id,
  clienteId: ana.id,
  calificacion: 5,
  comentario: "Puntual y muy cuidadoso con todo. Llegó todo perfecto.",
  creadoEn: hace(10)
});

// --- Solicitud publicada con presupuestos para comparar ---
const s2 = makeSolicitud(luis, LUGARES.centro, LUGARES.taficito, {
  titulo: "Heladera y lavarropas",
  tipoCarga: "mueble",
  descripcion: "Planta baja en ambos domicilios.",
  inventario: [item("Heladera", 1), item("Lavarropas", 1)]
});
makePresupuesto(s2, carlos, 22000, "Tengo disponibilidad el jueves.");
makePresupuesto(s2, sole, 19000, "Entra justo en la Kangoo, necesito un ayudante.");

// --- Solicitud confirmada (lista para registrar la carga) ---
const s3 = makeSolicitud(ana, LUGARES.mercado, LUGARES.barrioNorte, {
  titulo: "Compra del mayorista",
  tipoCarga: "compra",
  fecha: en(1),
  inventario: [item("Bolsas de mercadería", 6), item("Bidones de agua", 4)]
});
asignar(s3, makePresupuesto(s3, sole, 7000, "Paso a la tarde."));
s3.estado = "confirmada";
s3.historial.push({ estado: "confirmada", fecha: hace(2), usuarioId: ana.id });

// --- Solicitud publicada sin presupuestos todavía ---
makeSolicitud(luis, LUGARES.barrioNorte, LUGARES.barrioSur, {
  titulo: "Envío de documentación",
  tipoCarga: "paquete",
  tipoVehiculo: "moto",
  fecha: en(1),
  inventario: [item("Sobre A4", 1)]
});

await resetDB({ usuarios, fleteros, solicitudes, presupuestos, mensajes: [], resenas });

console.log("Base de datos poblada con datos de demo (Tucumán).");
console.log("Usuarios de prueba (contraseña: 123456):");
console.log("  Cliente:  ana@demo.com");
console.log("  Cliente:  luis@demo.com");
console.log("  Fletero:  carlos@demo.com (camioneta)");
console.log("  Fletero:  marta@demo.com  (moto)");
console.log("  Fletero:  jose@demo.com   (camión)");
console.log("  Fletero:  sole@demo.com   (auto)");
