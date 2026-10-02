-- Administración y mantenimiento: resolución de reclamos y registro de subidas pendientes
-- (para borrar las fotos que se firmaron pero nunca se adjuntaron).
-- Generada con `prisma migrate diff`.

ALTER TABLE "reclamos" ADD COLUMN "resolucion" VARCHAR(500),
  ADD COLUMN "resueltoPorId" TEXT;

ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_resueltoPorId_fkey"
  FOREIGN KEY ("resueltoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Resuelto ⇔ tiene resolución y fecha.
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamo_resolucion_completa" CHECK (
  ("estado" = 'RESUELTO') = ("resolucion" IS NOT NULL AND "resueltoEn" IS NOT NULL)
);

CREATE TABLE "subidas_pendientes" (
    "ruta" VARCHAR(300) NOT NULL,
    "bucket" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subidas_pendientes_pkey" PRIMARY KEY ("ruta")
);

CREATE INDEX "subidas_pendientes_createdAt_idx" ON "subidas_pendientes"("createdAt");

ALTER TABLE "subidas_pendientes" ENABLE ROW LEVEL SECURITY;
