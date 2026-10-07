import "server-only";
import { NextResponse } from "next/server";

// Respuestas JSON de los route handlers: nunca se cachean (son datos privados del usuario).
const SIN_CACHE = { "Cache-Control": "private, no-store" };

export const json = <T>(datos: T, status = 200) => NextResponse.json(datos, { status, headers: SIN_CACHE });
export const noAutenticado = () => json({ error: "Tu sesión expiró." }, 401);
export const noEncontrado = () => json({ error: "No encontrado." }, 404);
