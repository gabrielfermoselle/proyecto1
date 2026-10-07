import { describe, expect, it } from "vitest";
import { prisma } from "./prisma";

// Invariantes del esquema que cualquier migración futura tiene que respetar. No prueban una
// funcionalidad: atajan el error de quien agrega una tabla y se olvida de algo.

describe("invariantes del esquema", () => {
  it("todas las tablas de public tienen RLS activado", async () => {
    // La anon key de Supabase viaja al navegador (Realtime y Storage). Con RLS activo y sin
    // políticas, esa key no puede leer ninguna tabla por la API REST de Supabase. Una tabla
    // nueva sin RLS quedaría expuesta a cualquiera.
    const sinRls = await prisma.$queryRaw<{ tabla: string }[]>`
      SELECT tablename AS tabla FROM pg_tables
      WHERE schemaname = 'public' AND NOT rowsecurity
        AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')
      ORDER BY tablename`;

    expect(sinRls.map((t) => t.tabla)).toEqual([]);
  });

  it("toda clave foránea tiene un índice que empieza por sus columnas", async () => {
    // Sin índice, cada borrado en cascada o join por esa FK recorre la tabla hija entera.
    // Trinquete: estas son las que ya existían sin índice (deuda conocida). Una FK nueva sin
    // índice hace fallar el test; al indexar una de estas, hay que sacarla de la lista.
    const DEUDA_CONOCIDA = [
      // Prioridad alta: las consulta la regla "no dar de baja un vehículo en uso" (roadmap 1.7).
      "fletes_vehiculoId_fkey",
      "presupuestos_vehiculoId_fkey",
      // Prioridad baja: apuntan a users, que nunca se borra (la baja es una anonimización).
      "calificaciones_clienteId_fkey",
      "conformidades_userId_fkey",
      "controles_item_autorId_fkey",
      "estados_flete_autorId_fkey",
      "propuestas_horario_propuestaPorId_fkey",
      "propuestas_horario_respondidaPorId_fkey",
      "reclamos_autorId_fkey",
      "reclamos_resueltoPorId_fkey",
    ];
    const sinIndice = await prisma.$queryRaw<{ restriccion: string }[]>`
      SELECT c.conname AS restriccion
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace AND n.nspname = 'public'
      WHERE c.contype = 'f'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
        )
      ORDER BY 1`;

    expect(sinIndice.map((r) => r.restriccion).sort()).toEqual([...DEUDA_CONOCIDA].sort());
  });
});
