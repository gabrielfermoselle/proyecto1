# Directorio y Contratación de Oficios Tradicionales Validados (MVP)

Plataforma web que conecta a vecinos con profesionales de oficios (plomeros, electricistas,
carpinteros, etc.) resolviendo la **falta de transparencia** en la contratación de servicios del hogar.

El MVP implementa los **tres pilares técnicos** de la tesis:

1. **Geolocalización y cálculo de distancias** (fórmula de Haversine) para filtrar por zonas de
   cobertura. Mapa interactivo con OpenStreetMap/Leaflet.
2. **Sistema de reseñas anclado a transacciones reales**: un cliente solo puede reseñar a un
   trabajador si existe una contratación **completada** entre ambos, y una única vez. Esto evita
   spam y valoraciones falsas.
3. **Chat interno en tiempo real** (Socket.io) por contratación, para acordar presupuestos **sin
   exponer datos de contacto** (email/teléfono nunca se comparten).

## Stack

- **Backend:** Node.js + Express + Socket.io. Persistencia en archivo JSON (sin dependencias
  nativas, corre en cualquier lado). Auth con JWT + bcrypt.
- **Frontend:** React + Vite + React Router + React-Leaflet + Socket.io-client.

## Requisitos

- Node.js 18+ (probado con Node 22).

## Instalación

Desde la carpeta raíz del proyecto:

```bash
npm install
npm run install:all
```

## Datos de demo (recomendado)

Poblá la base con profesionales, trabajos y reseñas de ejemplo:

```bash
npm run seed
```

Usuarios de prueba (contraseña **123456** para todos):

| Rol         | Email            | Oficio        |
|-------------|------------------|---------------|
| Cliente     | ana@demo.com     | —             |
| Cliente     | luis@demo.com    | —             |
| Trabajador  | carlos@demo.com  | Plomería      |
| Trabajador  | marta@demo.com   | Electricidad  |
| Trabajador  | jose@demo.com    | Carpintería   |
| Trabajador  | sole@demo.com    | Pintura       |

## Ejecutar (desarrollo)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API + chat: http://localhost:4000 (Vite hace proxy de `/api` y `/socket.io`)

## Flujo de la demo

1. Entrá como **cliente** (`ana@demo.com`) y explorá el directorio. Usá **"Usar mi ubicación"** y el
   filtro de distancia para ver la geolocalización en acción.
2. Abrí el perfil de un trabajador → **"Solicitar contratación"**. Se crea el trabajo y se abre el
   **chat en tiempo real**.
3. En otra ventana, entrá como ese **trabajador** (ej. `carlos@demo.com`), abrí la contratación en
   "Mis contrataciones", **aceptala**, fijá un **presupuesto** y chateá con el cliente.
4. Marcá el trabajo como **completado**.
5. Volvé como **cliente** al trabajo completado y **dejá una reseña** (solo disponible ahí).

## Estructura

```
backend/   API Express + Socket.io + datastore JSON
  src/routes/   auth, workers, jobs, reviews, messages
  src/geo.js    cálculo de distancia (Haversine)
frontend/  App React (Vite)
  src/pages/    Directory, WorkerProfile, Dashboard, JobDetail, EditProfile, Login, Register
db/        Esquema y migraciones de Supabase (SQL)
```
