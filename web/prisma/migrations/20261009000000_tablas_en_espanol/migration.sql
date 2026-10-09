-- Las tablas que seguían en inglés pasan a español. El resto del esquema ya lo estaba.
ALTER TABLE "users" RENAME TO "usuarios";
ALTER TABLE "cliente_profiles" RENAME TO "perfiles_cliente";
ALTER TABLE "fletero_profiles" RENAME TO "perfiles_fletero";

ALTER INDEX "users_email_key" RENAME TO "usuarios_email_key";
ALTER INDEX "cliente_profiles_userId_key" RENAME TO "perfiles_cliente_userId_key";
ALTER INDEX "fletero_profiles_userId_key" RENAME TO "perfiles_fletero_userId_key";
ALTER INDEX "fletero_profiles_dni_key" RENAME TO "perfiles_fletero_dni_key";
ALTER INDEX "fletero_profiles_disponible_ratingPromedio_idx" RENAME TO "perfiles_fletero_disponible_ratingPromedio_idx";
ALTER INDEX "fletero_profiles_baseGeo_gix" RENAME TO "perfiles_fletero_baseGeo_gix";
