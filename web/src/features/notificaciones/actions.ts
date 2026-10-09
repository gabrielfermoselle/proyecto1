"use server";

import { z } from "zod";
import { createAction } from "@/lib/action";
import { ahoraIso, db, fallar } from "@/lib/db";

/** Marca como leídas las notificaciones indicadas (o todas). Solo las propias. */
export const marcarNotificacionesLeidas = createAction({
  schema: z.object({ ids: z.array(z.string().min(1).max(40)).max(100).optional() }),
  roles: ["CLIENTE", "FLETERO", "ADMIN"],
  handler: async ({ ids }, { usuario }) => {
    if (ids && ids.length === 0) return { marcadas: 0 };
    const leidaEn = ahoraIso();
    let q = db()
      .from("notificaciones")
      .update({ leidaEn, updatedAt: leidaEn })
      .eq("userId", usuario.id)
      .is("leidaEn", null);
    if (ids) q = q.in("id", ids);
    const { data, error } = await q.select("id");
    fallar(error);
    return { marcadas: data?.length ?? 0 };
  },
});
