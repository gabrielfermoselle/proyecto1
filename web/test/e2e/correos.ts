import { tmpdir } from "node:os";
import { join } from "node:path";

/** Archivo donde el servidor de e2e deja los emails (sin Resend): los tests leen los links de acá. */
export const ARCHIVO_CORREOS = join(tmpdir(), "fletes-tucuman-e2e-correos.jsonl");
