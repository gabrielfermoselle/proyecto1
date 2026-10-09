import { db } from "@/lib/db";
import {
  actualizar as actualizarFila,
  contar as contarFilas,
  filas as listar,
  insertar as insertarFila,
  insertarVarios as insertarVariasFilas,
  uno as unaFila,
  unoONull as unaFilaONull,
  vaciar as vaciarTabla,
} from "@/lib/filas";

const cliente = () => db();

export const insertar = <T extends Record<string, unknown>>(tabla: string, datos: Record<string, unknown>) =>
  insertarFila<T>(cliente(), tabla, datos);

export const insertarVarios = (tabla: string, filasDatos: Record<string, unknown>[]) =>
  insertarVariasFilas(cliente(), tabla, filasDatos);

export const filas = <T>(tabla: string, filtros: Record<string, unknown> = {}, orden?: { columna: string; asc?: boolean }) =>
  listar<T>(cliente(), tabla, filtros, orden);

export const uno = <T>(tabla: string, filtros: Record<string, unknown>) => unaFila<T>(cliente(), tabla, filtros);

export const unoONull = <T>(tabla: string, filtros: Record<string, unknown>) =>
  unaFilaONull<T>(cliente(), tabla, filtros);

export const contar = (tabla: string, filtros: Record<string, unknown> = {}) => contarFilas(cliente(), tabla, filtros);

export const actualizar = (tabla: string, filtros: Record<string, unknown>, datos: Record<string, unknown>) =>
  actualizarFila(cliente(), tabla, filtros, datos);

export const vaciar = (tabla: string, columna?: string) => vaciarTabla(cliente(), tabla, columna);
