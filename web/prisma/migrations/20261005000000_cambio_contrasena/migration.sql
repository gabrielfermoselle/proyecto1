-- Cambio de contraseña: las sesiones (JWT) iniciadas antes del último cambio dejan de valer.
ALTER TABLE "users" ADD COLUMN "credencialesCambiadasEn" TIMESTAMP(3);
