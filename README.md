# Fletes Tucumán — Plataforma de fletes

Plataforma web que conecta a quienes necesitan **trasladar algo en Tucumán** (una mudanza, un
mueble, una compra o un paquete) con **fleteros de todo tipo**: motos, autos, camionetas y camiones.

**Problema:** hoy hay que buscar un fletero por cuenta propia y pedir presupuesto uno por uno. No
existe un lugar donde comparar opciones, precios y cercanía; el precio suele ser aproximado porque
no se conoce la carga, y es difícil controlar que todo llegue en buen estado.

**Solución:** el cliente publica qué necesita trasladar (origen, destino, fecha, fotos e
inventario), los fleteros cercanos envían sus presupuestos y el cliente elige el que más le
conviene. Después se sigue el estado del flete y se controla con un inventario digital que todo
llegue a destino.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| [`web/`](web/) | La aplicación: Next.js 15 + TypeScript + Prisma + PostgreSQL/PostGIS + NextAuth + Supabase |
| [`web/README.md`](web/README.md) | Puesta en marcha local, scripts y usuarios de demo |
| [`web/DEPLOY.md`](web/DEPLOY.md) | Puesta en producción (Supabase + Vercel) |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Documento de arquitectura: capas, carpetas, base de datos, API y eventos, seguridad, imágenes y geolocalización, convenciones, testing, Git, despliegue y sprints |

## Inicio rápido

```bash
cd web
cp .env.example .env   # completar DATABASE_URL, DIRECT_URL y NEXTAUTH_SECRET
npm install
npm run db:deploy
npm run db:seed        # BORRA la base y carga los datos de demo
npm run dev            # http://localhost:3000
```
