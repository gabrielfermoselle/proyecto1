-- PostGIS. En Supabase suele venir instalado en el schema "extensions" (ya incluido en el
-- search_path); IF NOT EXISTS lo respeta. En un Postgres local se instala en public.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'FLETERO', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('MOTO', 'AUTO', 'CAMIONETA', 'CAMION');

-- CreateEnum
CREATE TYPE "TipoFlete" AS ENUM ('MUDANZA', 'MUEBLES', 'COMPRAS', 'PAQUETERIA', 'OTRO');

-- CreateEnum
CREATE TYPE "FranjaHoraria" AS ENUM ('MANANA', 'MEDIODIA', 'TARDE', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('ABIERTA', 'ADJUDICADA', 'CANCELADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "EtapaFlete" AS ENUM ('CONFIRMADO', 'CARGADO', 'EN_TRANSITO', 'ENTREGADO', 'COMPLETADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "telefono" VARCHAR(20),
    "avatarUrl" TEXT,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direccionHabitual" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "cliente_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fletero_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dni" VARCHAR(10),
    "bio" VARCHAR(500),
    "baseDireccion" TEXT,
    "baseLat" DOUBLE PRECISION,
    "baseLng" DOUBLE PRECISION,
    "baseGeo" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("baseLng", "baseLat"), 4326)::geography) STORED,
    "radioCoberturaKm" INTEGER NOT NULL DEFAULT 15,
    "precioMinimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioPorKm" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "precioPorM3" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "precioPorAyudante" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletadoEn" TIMESTAMP(3),
    "ratingPromedio" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "cantidadCalificaciones" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fletero_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "marca" VARCHAR(40) NOT NULL,
    "modelo" VARCHAR(40) NOT NULL,
    "anio" INTEGER,
    "patente" VARCHAR(10) NOT NULL,
    "capacidadKg" INTEGER NOT NULL,
    "volumenM3" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipoFlete" "TipoFlete" NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(1000),
    "origenDireccion" TEXT NOT NULL,
    "origenLat" DOUBLE PRECISION NOT NULL,
    "origenLng" DOUBLE PRECISION NOT NULL,
    "origenGeo" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("origenLng", "origenLat"), 4326)::geography) STORED,
    "origenPiso" INTEGER,
    "origenAscensor" BOOLEAN NOT NULL DEFAULT false,
    "destinoDireccion" TEXT NOT NULL,
    "destinoLat" DOUBLE PRECISION NOT NULL,
    "destinoLng" DOUBLE PRECISION NOT NULL,
    "destinoPiso" INTEGER,
    "destinoAscensor" BOOLEAN NOT NULL DEFAULT false,
    "distanciaKm" DECIMAL(7,2) NOT NULL,
    "pesoTotalKg" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "volumenTotalM3" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "itemsSinMedidas" INTEGER NOT NULL DEFAULT 0,
    "fecha" DATE NOT NULL,
    "franja" "FranjaHoraria" NOT NULL,
    "tipoVehiculoSugerido" "TipoVehiculo",
    "ayudantesRequeridos" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_inventario" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "largoCm" INTEGER,
    "anchoCm" INTEGER,
    "altoCm" INTEGER,
    "pesoKgAprox" DECIMAL(7,2),
    "fragil" BOOLEAN NOT NULL DEFAULT false,
    "notas" VARCHAR(300),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "cargadoEn" TIMESTAMP(3),
    "descargadoEn" TIMESTAMP(3),

    CONSTRAINT "items_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "ancho" INTEGER,
    "alto" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitudId" TEXT,
    "itemId" TEXT,
    "vehiculoId" TEXT,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "montoSugerido" DECIMAL(12,2) NOT NULL,
    "incluyeAyudantes" INTEGER NOT NULL DEFAULT 0,
    "mensaje" VARCHAR(500),
    "validoHasta" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fletes" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "precioAcordado" DECIMAL(12,2) NOT NULL,
    "etapa" "EtapaFlete" NOT NULL DEFAULT 'CONFIRMADO',
    "recepcionConfirmadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_flete" (
    "id" TEXT NOT NULL,
    "fleteId" TEXT NOT NULL,
    "etapa" "EtapaFlete" NOT NULL,
    "autorId" TEXT NOT NULL,
    "nota" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estados_flete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" VARCHAR(2000) NOT NULL,
    "leidoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id" TEXT NOT NULL,
    "fleteId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_profiles_userId_key" ON "cliente_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fletero_profiles_userId_key" ON "fletero_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fletero_profiles_dni_key" ON "fletero_profiles"("dni");

-- CreateIndex
CREATE INDEX "fletero_profiles_disponible_ratingPromedio_idx" ON "fletero_profiles"("disponible", "ratingPromedio");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_patente_key" ON "vehiculos"("patente");

-- CreateIndex
CREATE INDEX "vehiculos_fleteroId_tipo_activo_idx" ON "vehiculos"("fleteroId", "tipo", "activo");

-- CreateIndex
CREATE INDEX "solicitudes_estado_fecha_idx" ON "solicitudes"("estado", "fecha");

-- CreateIndex
CREATE INDEX "solicitudes_clienteId_estado_idx" ON "solicitudes"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "items_inventario_solicitudId_idx" ON "items_inventario"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_publicId_key" ON "fotos"("publicId");

-- CreateIndex
CREATE INDEX "fotos_solicitudId_idx" ON "fotos"("solicitudId");

-- CreateIndex
CREATE INDEX "fotos_itemId_idx" ON "fotos"("itemId");

-- CreateIndex
CREATE INDEX "fotos_vehiculoId_idx" ON "fotos"("vehiculoId");

-- CreateIndex
CREATE INDEX "presupuestos_solicitudId_estado_idx" ON "presupuestos"("solicitudId", "estado");

-- CreateIndex
CREATE INDEX "presupuestos_fleteroId_estado_idx" ON "presupuestos"("fleteroId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_solicitudId_fleteroId_key" ON "presupuestos"("solicitudId", "fleteroId");

-- CreateIndex
CREATE UNIQUE INDEX "fletes_solicitudId_key" ON "fletes"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "fletes_presupuestoId_key" ON "fletes"("presupuestoId");

-- CreateIndex
CREATE INDEX "fletes_clienteId_etapa_idx" ON "fletes"("clienteId", "etapa");

-- CreateIndex
CREATE INDEX "fletes_fleteroId_etapa_idx" ON "fletes"("fleteroId", "etapa");

-- CreateIndex
CREATE INDEX "estados_flete_fleteId_createdAt_idx" ON "estados_flete"("fleteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_solicitudId_fleteroId_key" ON "conversaciones"("solicitudId", "fleteroId");

-- CreateIndex
CREATE INDEX "mensajes_conversacionId_createdAt_idx" ON "mensajes"("conversacionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "calificaciones_fleteId_key" ON "calificaciones"("fleteId");

-- CreateIndex
CREATE INDEX "calificaciones_fleteroId_createdAt_idx" ON "calificaciones"("fleteroId", "createdAt");

-- AddForeignKey
ALTER TABLE "cliente_profiles" ADD CONSTRAINT "cliente_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletero_profiles" ADD CONSTRAINT "fletero_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_fleteroId_fkey" FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_fleteroId_fkey" FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletes" ADD CONSTRAINT "fletes_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletes" ADD CONSTRAINT "fletes_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletes" ADD CONSTRAINT "fletes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletes" ADD CONSTRAINT "fletes_fleteroId_fkey" FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fletes" ADD CONSTRAINT "fletes_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_flete" ADD CONSTRAINT "estados_flete_fleteId_fkey" FOREIGN KEY ("fleteId") REFERENCES "fletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_flete" ADD CONSTRAINT "estados_flete_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_fleteroId_fkey" FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_fleteId_fkey" FOREIGN KEY ("fleteId") REFERENCES "fletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_fleteroId_fkey" FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Lo que Prisma no puede expresar: reglas de integridad e índices espaciales.
-- ---------------------------------------------------------------------------

-- Índices GIST para ST_DWithin / ST_Distance (buscador y feed por radio).
CREATE INDEX "fletero_profiles_baseGeo_gix" ON "fletero_profiles" USING GIST ("baseGeo");
CREATE INDEX "solicitudes_origenGeo_gix" ON "solicitudes" USING GIST ("origenGeo");

ALTER TABLE "fletero_profiles"
  ADD CONSTRAINT "fletero_radio_rango" CHECK ("radioCoberturaKm" BETWEEN 1 AND 100),
  ADD CONSTRAINT "fletero_tarifas_no_negativas" CHECK (
    "precioMinimo" >= 0 AND "precioPorKm" >= 0 AND "precioPorM3" >= 0 AND "precioPorAyudante" >= 0
  ),
  ADD CONSTRAINT "fletero_rating_rango" CHECK ("ratingPromedio" BETWEEN 0 AND 5),
  ADD CONSTRAINT "fletero_base_completa" CHECK (("baseLat" IS NULL) = ("baseLng" IS NULL));

ALTER TABLE "vehiculos"
  ADD CONSTRAINT "vehiculo_capacidad_positiva" CHECK ("capacidadKg" > 0 AND "volumenM3" > 0);

ALTER TABLE "solicitudes"
  ADD CONSTRAINT "solicitud_ayudantes_rango" CHECK ("ayudantesRequeridos" BETWEEN 0 AND 10),
  ADD CONSTRAINT "solicitud_totales_no_negativos" CHECK (
    "distanciaKm" >= 0 AND "pesoTotalKg" >= 0 AND "volumenTotalM3" >= 0 AND "itemsSinMedidas" >= 0
  );

ALTER TABLE "items_inventario"
  ADD CONSTRAINT "item_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "item_medidas_positivas" CHECK (
    ("largoCm" IS NULL OR "largoCm" > 0) AND ("anchoCm" IS NULL OR "anchoCm" > 0)
    AND ("altoCm" IS NULL OR "altoCm" > 0) AND ("pesoKgAprox" IS NULL OR "pesoKgAprox" > 0)
  );

ALTER TABLE "fotos"
  ADD CONSTRAINT "foto_un_solo_duenio" CHECK (num_nonnulls("solicitudId", "itemId", "vehiculoId") = 1);

ALTER TABLE "presupuestos"
  ADD CONSTRAINT "presupuesto_montos_positivos" CHECK ("monto" > 0 AND "montoSugerido" >= 0),
  ADD CONSTRAINT "presupuesto_ayudantes_rango" CHECK ("incluyeAyudantes" BETWEEN 0 AND 10);

ALTER TABLE "fletes"
  ADD CONSTRAINT "flete_precio_positivo" CHECK ("precioAcordado" > 0);

ALTER TABLE "calificaciones"
  ADD CONSTRAINT "calificacion_puntaje_rango" CHECK ("puntaje" BETWEEN 1 AND 5);

-- La app usa el rol "postgres" vía Prisma; nadie accede por la API REST de Supabase.
-- Con RLS activo y sin políticas, la anon key no puede leer ni escribir estas tablas.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cliente_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fletero_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehiculos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitudes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items_inventario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fotos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presupuestos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fletes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estados_flete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensajes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calificaciones" ENABLE ROW LEVEL SECURITY;
