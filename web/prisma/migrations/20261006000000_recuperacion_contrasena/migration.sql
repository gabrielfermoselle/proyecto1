-- Recuperación de contraseña por email: tokens de un solo uso con vencimiento (solo el hash).
CREATE TABLE "tokens_recuperacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_recuperacion_tokenHash_key" ON "tokens_recuperacion"("tokenHash");
CREATE INDEX "tokens_recuperacion_userId_idx" ON "tokens_recuperacion"("userId");
CREATE INDEX "tokens_recuperacion_expiraEn_idx" ON "tokens_recuperacion"("expiraEn");

ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tokens_recuperacion"
  ADD CONSTRAINT "token_hash_sha256" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "token_vence_despues" CHECK ("expiraEn" > "createdAt");

ALTER TABLE "tokens_recuperacion" ENABLE ROW LEVEL SECURITY;
