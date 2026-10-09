-- Campos del esquema por rol: extra de embalaje y motivo de cancelación en la solicitud, hora de
-- llegada en el presupuesto y documentación del fletero para la verificación.
ALTER TABLE "solicitudes"
  ADD COLUMN "requiereEmbalaje" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivoCancelacion" VARCHAR(300);

ALTER TABLE "presupuestos" ADD COLUMN "horaLlegada" VARCHAR(5);
ALTER TABLE "presupuestos"
  ADD CONSTRAINT "presupuesto_hora_llegada_hhmm" CHECK ("horaLlegada" IS NULL OR "horaLlegada" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE TYPE "TipoDocumento" AS ENUM ('DNI_FRENTE', 'DNI_DORSO', 'LICENCIA', 'SEGURO');

CREATE TABLE "documentos_fletero" (
    "id" TEXT NOT NULL,
    "fleteroId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "ruta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_fletero_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documentos_fletero_ruta_key" ON "documentos_fletero"("ruta");
CREATE UNIQUE INDEX "documentos_fletero_fleteroId_tipo_key" ON "documentos_fletero"("fleteroId", "tipo");

ALTER TABLE "documentos_fletero" ADD CONSTRAINT "documentos_fletero_fleteroId_fkey"
  FOREIGN KEY ("fleteroId") REFERENCES "fletero_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentos_fletero" ENABLE ROW LEVEL SECURITY;
