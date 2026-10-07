-- Inventario digital y seguimiento: etapas nuevas del flete, check-in/check-out por ítem,
-- reclamos, conformidades y ubicación en el historial.
-- Generada con `prisma migrate diff` y ajustada a mano para convertir los datos existentes.

-- CreateEnum
CREATE TYPE "EstadoInicialItem" AS ENUM ('BUENO', 'CON_MARCAS', 'DANADO');
CREATE TYPE "FaseControl" AS ENUM ('CARGA', 'DESCARGA', 'RECEPCION');
CREATE TYPE "ResultadoControl" AS ENUM ('CARGADO', 'NO_CARGADO', 'ENTREGADO', 'CON_DANO', 'FALTANTE', 'CONFORME', 'RECLAMO');
CREATE TYPE "EstadoReclamo" AS ENUM ('ABIERTO', 'RESUELTO');

-- ---------------------------------------------------------------------------
-- Etapas del flete. Se cambia el tipo con un mapeo explícito (un cast directo fallaría):
--   CARGADO     → CARGANDO     (todo cargado, falta salir: el fletero solo toca "salgo")
--   EN_TRANSITO → EN_TRASLADO
--   COMPLETADO  → CERRADO
-- ---------------------------------------------------------------------------
CREATE TYPE "EtapaFlete_new" AS ENUM ('CONFIRMADO', 'EN_CAMINO_A_ORIGEN', 'CARGANDO', 'EN_TRASLADO', 'DESCARGANDO', 'ENTREGADO', 'CERRADO', 'CANCELADO');

ALTER TABLE "fletes" ALTER COLUMN "etapa" DROP DEFAULT;
ALTER TABLE "fletes" ALTER COLUMN "etapa" TYPE "EtapaFlete_new" USING (CASE "etapa"::text WHEN 'CARGADO' THEN 'CARGANDO' WHEN 'EN_TRANSITO' THEN 'EN_TRASLADO' WHEN 'COMPLETADO' THEN 'CERRADO' ELSE "etapa"::text END)::"EtapaFlete_new";
ALTER TABLE "estados_flete" ALTER COLUMN "etapa" TYPE "EtapaFlete_new" USING (CASE "etapa"::text WHEN 'CARGADO' THEN 'CARGANDO' WHEN 'EN_TRANSITO' THEN 'EN_TRASLADO' WHEN 'COMPLETADO' THEN 'CERRADO' ELSE "etapa"::text END)::"EtapaFlete_new";
ALTER TYPE "EtapaFlete" RENAME TO "EtapaFlete_old";
ALTER TYPE "EtapaFlete_new" RENAME TO "EtapaFlete";
DROP TYPE "EtapaFlete_old";
ALTER TABLE "fletes" ALTER COLUMN "etapa" SET DEFAULT 'CONFIRMADO';

-- ---------------------------------------------------------------------------
-- Tablas nuevas
-- ---------------------------------------------------------------------------
CREATE TABLE "controles_item" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fleteId" TEXT NOT NULL,
    "fase" "FaseControl" NOT NULL,
    "resultado" "ResultadoControl" NOT NULL,
    "observacion" VARCHAR(300),
    "autorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controles_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reclamos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fleteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conformidades" (
    "id" TEXT NOT NULL,
    "fleteId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "userId" TEXT NOT NULL,
    "texto" VARCHAR(500) NOT NULL,
    "aceptadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conformidades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "controles_item_fleteId_idx" ON "controles_item"("fleteId");
CREATE UNIQUE INDEX "controles_item_itemId_fase_key" ON "controles_item"("itemId", "fase");
CREATE UNIQUE INDEX "reclamos_itemId_key" ON "reclamos"("itemId");
CREATE INDEX "reclamos_fleteId_idx" ON "reclamos"("fleteId");
CREATE UNIQUE INDEX "conformidades_fleteId_rol_key" ON "conformidades"("fleteId", "rol");

ALTER TABLE "controles_item" ADD CONSTRAINT "controles_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "controles_item" ADD CONSTRAINT "controles_item_fleteId_fkey" FOREIGN KEY ("fleteId") REFERENCES "fletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "controles_item" ADD CONSTRAINT "controles_item_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_fleteId_fkey" FOREIGN KEY ("fleteId") REFERENCES "fletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conformidades" ADD CONSTRAINT "conformidades_fleteId_fkey" FOREIGN KEY ("fleteId") REFERENCES "fletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conformidades" ADD CONSTRAINT "conformidades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Datos existentes: las marcas de carga/descarga pasan a ser controles, y los fletes que ya
-- se entregaron o cerraron quedan con sus firmas (marcadas como migradas).
-- ---------------------------------------------------------------------------
INSERT INTO "controles_item" ("id", "itemId", "fleteId", "fase", "resultado", "autorId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i.id, f.id, 'CARGA', 'CARGADO', fp."userId", i."cargadoEn", i."cargadoEn"
FROM "items_inventario" i
JOIN "fletes" f ON f."solicitudId" = i."solicitudId"
JOIN "fletero_profiles" fp ON fp.id = f."fleteroId"
WHERE i."cargadoEn" IS NOT NULL;

INSERT INTO "controles_item" ("id", "itemId", "fleteId", "fase", "resultado", "autorId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i.id, f.id, 'DESCARGA', 'ENTREGADO', fp."userId", i."descargadoEn", i."descargadoEn"
FROM "items_inventario" i
JOIN "fletes" f ON f."solicitudId" = i."solicitudId"
JOIN "fletero_profiles" fp ON fp.id = f."fleteroId"
WHERE i."descargadoEn" IS NOT NULL AND i."cargadoEn" IS NOT NULL;

INSERT INTO "controles_item" ("id", "itemId", "fleteId", "fase", "resultado", "autorId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i.id, f.id, 'RECEPCION', 'CONFORME', cp."userId",
       COALESCE(f."recepcionConfirmadaEn", f."updatedAt"), COALESCE(f."recepcionConfirmadaEn", f."updatedAt")
FROM "items_inventario" i
JOIN "fletes" f ON f."solicitudId" = i."solicitudId"
JOIN "cliente_profiles" cp ON cp.id = f."clienteId"
WHERE f.etapa = 'CERRADO' AND i."cargadoEn" IS NOT NULL;

INSERT INTO "conformidades" ("id", "fleteId", "rol", "userId", "texto", "aceptadaEn")
SELECT gen_random_uuid()::text, f.id, 'FLETERO', fp."userId",
       'Entrega registrada antes del inventario digital (sin firma detallada).',
       COALESCE((SELECT max(e."createdAt") FROM "estados_flete" e WHERE e."fleteId" = f.id AND e.etapa = 'ENTREGADO'), f."updatedAt")
FROM "fletes" f JOIN "fletero_profiles" fp ON fp.id = f."fleteroId"
WHERE f.etapa IN ('ENTREGADO', 'CERRADO');

INSERT INTO "conformidades" ("id", "fleteId", "rol", "userId", "texto", "aceptadaEn")
SELECT gen_random_uuid()::text, f.id, 'CLIENTE', cp."userId",
       'Recepción confirmada antes del inventario digital (sin firma detallada).',
       COALESCE(f."recepcionConfirmadaEn", f."updatedAt")
FROM "fletes" f JOIN "cliente_profiles" cp ON cp.id = f."clienteId"
WHERE f.etapa = 'CERRADO';

-- ---------------------------------------------------------------------------
-- Columnas
-- ---------------------------------------------------------------------------
ALTER TABLE "items_inventario" DROP COLUMN "cargadoEn",
  DROP COLUMN "descargadoEn",
  ADD COLUMN "estadoInicial" "EstadoInicialItem" NOT NULL DEFAULT 'BUENO';

ALTER TABLE "fotos" ADD COLUMN "controlId" TEXT, ADD COLUMN "reclamoId" TEXT;
CREATE INDEX "fotos_controlId_idx" ON "fotos"("controlId");
CREATE INDEX "fotos_reclamoId_idx" ON "fotos"("reclamoId");
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controles_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estados_flete" ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION,
  ADD COLUMN "precisionM" INTEGER;

-- ---------------------------------------------------------------------------
-- Reglas de integridad
-- ---------------------------------------------------------------------------
ALTER TABLE "fotos" DROP CONSTRAINT "foto_un_solo_duenio";
ALTER TABLE "fotos" ADD CONSTRAINT "foto_un_solo_duenio"
  CHECK (num_nonnulls("solicitudId", "itemId", "vehiculoId", "mensajeId", "controlId", "reclamoId") = 1);

-- Cada fase admite solo sus resultados (lo mismo que RESULTADOS_DE_FASE en el dominio).
ALTER TABLE "controles_item" ADD CONSTRAINT "control_resultado_de_su_fase" CHECK (
  ("fase" = 'CARGA' AND "resultado" IN ('CARGADO', 'NO_CARGADO')) OR
  ("fase" = 'DESCARGA' AND "resultado" IN ('ENTREGADO', 'CON_DANO', 'FALTANTE')) OR
  ("fase" = 'RECEPCION' AND "resultado" IN ('CONFORME', 'RECLAMO'))
);

-- La ubicación va completa o no va, y con coordenadas válidas (los IS NOT NULL son necesarios:
-- un CHECK que evalúa a NULL pasa).
ALTER TABLE "estados_flete" ADD CONSTRAINT "estado_ubicacion_valida" CHECK (
  ("lat" IS NULL AND "lng" IS NULL AND "precisionM" IS NULL) OR
  ("lat" IS NOT NULL AND "lng" IS NOT NULL AND "lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180
   AND ("precisionM" IS NULL OR "precisionM" >= 0))
);

ALTER TABLE "controles_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reclamos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conformidades" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Solo en Supabase: las URLs firmadas de subida no limitan el tipo ni el tamaño del archivo,
-- así que lo limita el bucket. El navegador siempre sube JPEG comprimido (~300 KB): sin esto,
-- se podría subir HTML u otros archivos al bucket público, o archivos enormes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets
    SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg']
    WHERE id IN ('fotos-publicas', 'fotos-privadas');
  END IF;
END
$$;
