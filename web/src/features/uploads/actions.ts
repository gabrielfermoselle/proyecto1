"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import {
  BUCKET_PRIVADO,
  BUCKET_PUBLICO,
  guardarImagen,
  rutaReservada,
  TAMANO_MAXIMO_FOTO_BYTES,
} from "./storage";

// base64 pesa ~4/3 que el binario; dejamos un poco de margen sobre el límite del bucket (5 MB).
const MAXIMO_BASE64 = Math.ceil((TAMANO_MAXIMO_FOTO_BYTES * 4) / 3) + 1024;

const subirImagenSchema = z.object({
  bucket: z.enum([BUCKET_PUBLICO, BUCKET_PRIVADO]),
  ruta: z.string().min(1).max(300),
  dataBase64: z.string().min(1).max(MAXIMO_BASE64),
});

/**
 * Sube una foto ya comprimida a una ruta que una acción previa reservó. El binario viaja por el
 * servidor (en base64) y se guarda con la service_role; no hace falta exponer la anon key.
 */
export const subirImagenAlmacen = createAction({
  schema: subirImagenSchema,
  roles: ["CLIENTE", "FLETERO"],
  handler: async ({ bucket, ruta, dataBase64 }, { usuario }) => {
    await consumirLimite(LIMITES.imagenes(usuario.id));
    if (!(await rutaReservada(bucket, ruta))) {
      throw new ActionError("No pudimos subir la foto. Probá de nuevo.");
    }
    const bytes = new Uint8Array(Buffer.from(dataBase64, "base64"));
    await guardarImagen(bucket, ruta, bytes);
    return { ruta };
  },
});
