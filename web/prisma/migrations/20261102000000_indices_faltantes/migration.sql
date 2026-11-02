-- Índices que faltaban para las consultas del admin y la baja de vehículos.
-- Cada uno acompaña un @@index de schema.prisma con el nombre que genera Prisma.

-- Listado de cuentas del admin: filtra por rol y ordena por alta.
CREATE INDEX IF NOT EXISTS "usuarios_rol_createdAt_idx" ON "usuarios"("rol", "createdAt");

-- Cola de verificación del admin: no verificados con el onboarding completo.
CREATE INDEX IF NOT EXISTS "perfiles_fletero_verificado_onboardingCompletadoEn_idx"
  ON "perfiles_fletero"("verificado", "onboardingCompletadoEn");

-- Últimos pedidos del admin.
CREATE INDEX IF NOT EXISTS "solicitudes_createdAt_idx" ON "solicitudes"("createdAt");

-- Baja de vehículos: presupuestos pendientes y fletes en curso con ese vehículo. Además,
-- "vehiculoId" es clave foránea y Postgres no la indexa solo.
CREATE INDEX IF NOT EXISTS "presupuestos_vehiculoId_estado_idx" ON "presupuestos"("vehiculoId", "estado");
CREATE INDEX IF NOT EXISTS "fletes_vehiculoId_etapa_idx" ON "fletes"("vehiculoId", "etapa");

-- Métricas del admin: fletes por etapa sin filtrar por cliente ni fletero.
CREATE INDEX IF NOT EXISTS "fletes_etapa_idx" ON "fletes"("etapa");

-- Bandeja de reclamos del admin: por estado, los más nuevos primero.
CREATE INDEX IF NOT EXISTS "reclamos_estado_createdAt_idx" ON "reclamos"("estado", "createdAt");

-- Claves foráneas hacia usuarios que no tenían índice (deuda en invariantes-base.db.test.ts).
-- Sin índice, borrar o anonimizar un usuario recorre cada tabla hija entera.
CREATE INDEX IF NOT EXISTS "calificaciones_clienteId_idx" ON "calificaciones"("clienteId");
CREATE INDEX IF NOT EXISTS "conformidades_userId_idx" ON "conformidades"("userId");
CREATE INDEX IF NOT EXISTS "controles_item_autorId_idx" ON "controles_item"("autorId");
CREATE INDEX IF NOT EXISTS "estados_flete_autorId_idx" ON "estados_flete"("autorId");
CREATE INDEX IF NOT EXISTS "propuestas_horario_propuestaPorId_idx" ON "propuestas_horario"("propuestaPorId");
CREATE INDEX IF NOT EXISTS "propuestas_horario_respondidaPorId_idx" ON "propuestas_horario"("respondidaPorId");
CREATE INDEX IF NOT EXISTS "reclamos_autorId_idx" ON "reclamos"("autorId");
CREATE INDEX IF NOT EXISTS "reclamos_resueltoPorId_idx" ON "reclamos"("resueltoPorId");
