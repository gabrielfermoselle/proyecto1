-- Chat interno, notificaciones, limitador de envíos y fotos en Supabase Storage.
-- Generada con `prisma migrate diff` y ajustada a mano para preservar los datos existentes.

-- CreateEnum
CREATE TYPE "TipoMensaje" AS ENUM ('TEXTO', 'IMAGEN', 'SISTEMA', 'PROPUESTA');
CREATE TYPE "EstadoPropuesta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'ANULADA');
CREATE TYPE "TipoNotificacion" AS ENUM ('MENSAJE', 'PRESUPUESTO', 'FLETE', 'PROPUESTA');

-- ---------------------------------------------------------------------------
-- Fotos: de Cloudinary (url + publicId) a Supabase Storage (ruta en el bucket).
-- Se renombra la columna en lugar de borrarla para no perder filas existentes.
-- ---------------------------------------------------------------------------
ALTER TABLE "fotos" RENAME COLUMN "publicId" TO "ruta";
ALTER INDEX "fotos_publicId_key" RENAME TO "fotos_ruta_key";
ALTER TABLE "fotos" DROP COLUMN "url", ADD COLUMN "mensajeId" TEXT;

-- ---------------------------------------------------------------------------
-- Conversaciones: cliente desnormalizado, última actividad y marcas de lectura.
-- ---------------------------------------------------------------------------
ALTER TABLE "conversaciones"
  ADD COLUMN "clienteId" TEXT,
  ADD COLUMN "leidoHastaCliente" TIMESTAMP(3),
  ADD COLUMN "leidoHastaFletero" TIMESTAMP(3),
  ADD COLUMN "ultimaActividadEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "conversaciones" c SET "clienteId" = s."clienteId" FROM "solicitudes" s WHERE s.id = c."solicitudId";
ALTER TABLE "conversaciones" ALTER COLUMN "clienteId" SET NOT NULL;

UPDATE "conversaciones" c
SET "ultimaActividadEn" = COALESCE((SELECT max(m."createdAt") FROM "mensajes" m WHERE m."conversacionId" = c.id), c."createdAt");

-- Las marcas de lectura reemplazan a mensajes.leidoEn: se calculan antes de borrar la columna.
UPDATE "conversaciones" c SET
  "leidoHastaCliente" = (
    SELECT max(m."createdAt") FROM "mensajes" m
    JOIN "users" u ON u.id = m."autorId"
    WHERE m."conversacionId" = c.id AND m."leidoEn" IS NOT NULL AND u.rol = 'FLETERO'
  ),
  "leidoHastaFletero" = (
    SELECT max(m."createdAt") FROM "mensajes" m
    JOIN "users" u ON u.id = m."autorId"
    WHERE m."conversacionId" = c.id AND m."leidoEn" IS NOT NULL AND u.rol = 'CLIENTE'
  );

-- ---------------------------------------------------------------------------
-- Mensajes: tipos, eventos de sistema e idempotencia del envío.
-- ---------------------------------------------------------------------------
ALTER TABLE "mensajes" DROP CONSTRAINT "mensajes_autorId_fkey";
DROP INDEX "mensajes_conversacionId_createdAt_idx";
ALTER TABLE "mensajes" DROP COLUMN "leidoEn",
  ADD COLUMN "clientId" VARCHAR(40),
  ADD COLUMN "datos" JSONB,
  ADD COLUMN "evento" VARCHAR(40),
  ADD COLUMN "tipo" "TipoMensaje" NOT NULL DEFAULT 'TEXTO',
  ALTER COLUMN "autorId" DROP NOT NULL,
  ALTER COLUMN "contenido" DROP NOT NULL;

-- CreateTable
CREATE TABLE "propuestas_horario" (
    "id" TEXT NOT NULL,
    "mensajeId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "franja" "FranjaHoraria" NOT NULL,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'PENDIENTE',
    "propuestaPorId" TEXT NOT NULL,
    "respondidaPorId" TEXT,
    "respondidaEn" TIMESTAMP(3),
    "aplicadaEn" TIMESTAMP(3),

    CONSTRAINT "propuestas_horario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "cuerpo" VARCHAR(300),
    "href" VARCHAR(300) NOT NULL,
    "clave" VARCHAR(120),
    "leidaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "limites_tasa" (
    "clave" VARCHAR(160) NOT NULL,
    "ventana" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "limites_tasa_pkey" PRIMARY KEY ("clave","ventana")
);

-- CreateIndex
CREATE UNIQUE INDEX "propuestas_horario_mensajeId_key" ON "propuestas_horario"("mensajeId");
CREATE INDEX "notificaciones_userId_leidaEn_updatedAt_idx" ON "notificaciones"("userId", "leidaEn", "updatedAt");
CREATE UNIQUE INDEX "notificaciones_userId_clave_key" ON "notificaciones"("userId", "clave");
CREATE INDEX "fotos_mensajeId_idx" ON "fotos"("mensajeId");
CREATE INDEX "conversaciones_clienteId_ultimaActividadEn_idx" ON "conversaciones"("clienteId", "ultimaActividadEn");
CREATE INDEX "conversaciones_fleteroId_ultimaActividadEn_idx" ON "conversaciones"("fleteroId", "ultimaActividadEn");
CREATE INDEX "mensajes_conversacionId_createdAt_id_idx" ON "mensajes"("conversacionId", "createdAt" DESC, "id");
CREATE UNIQUE INDEX "mensajes_autorId_clientId_key" ON "mensajes"("autorId", "clientId");

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "propuestas_horario" ADD CONSTRAINT "propuestas_horario_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "propuestas_horario" ADD CONSTRAINT "propuestas_horario_propuestaPorId_fkey" FOREIGN KEY ("propuestaPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "propuestas_horario" ADD CONSTRAINT "propuestas_horario_respondidaPorId_fkey" FOREIGN KEY ("respondidaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reglas de integridad.
-- ---------------------------------------------------------------------------
ALTER TABLE "fotos" DROP CONSTRAINT "foto_un_solo_duenio";
ALTER TABLE "fotos"
  ADD CONSTRAINT "foto_un_solo_duenio" CHECK (num_nonnulls("solicitudId", "itemId", "vehiculoId", "mensajeId") = 1);

-- Los mensajes de sistema llevan un evento; el resto no.
ALTER TABLE "mensajes"
  ADD CONSTRAINT "mensaje_evento_solo_sistema" CHECK (("tipo" = 'SISTEMA') = ("evento" IS NOT NULL)),
  ADD CONSTRAINT "mensaje_texto_no_vacio" CHECK ("contenido" IS NULL OR length("contenido") > 0);

ALTER TABLE "limites_tasa" ADD CONSTRAINT "limite_cantidad_positiva" CHECK ("cantidad" >= 0);

ALTER TABLE "propuestas_horario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "limites_tasa" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Solo en Supabase: autorización de Realtime y buckets de Storage.
-- En un Postgres común (desarrollo, tests) estos schemas no existen y el bloque no hace nada.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime')
     AND to_regclass('realtime.messages') IS NOT NULL THEN
    -- El servidor emite un JWT de 15 minutos con la lista de canales ("topics") que el
    -- usuario puede usar; la política solo deja suscribirse a esos.
    EXECUTE $p$
      CREATE POLICY "fletes: leer canales autorizados" ON realtime.messages
      FOR SELECT TO authenticated
      USING (realtime.topic() IN (SELECT jsonb_array_elements_text(auth.jwt() -> 'topics')))
    $p$;
    -- Los clientes solo emiten en conversaciones ("escribiendo…" y presencia); los avisos de la
    -- bandeja (usuario:*) los publica únicamente el servidor.
    EXECUTE $p$
      CREATE POLICY "fletes: emitir en conversaciones autorizadas" ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (
        realtime.topic() LIKE 'conversacion:%'
        AND realtime.messages.extension IN ('broadcast', 'presence')
        AND realtime.topic() IN (SELECT jsonb_array_elements_text(auth.jwt() -> 'topics'))
      )
    $p$;
  END IF;

  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('fotos-publicas', 'fotos-publicas', true), ('fotos-privadas', 'fotos-privadas', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
