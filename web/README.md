# Fletes Tucumán — app web

Next.js 15 (App Router) + TypeScript estricto + Prisma + PostgreSQL/PostGIS + NextAuth.

## Puesta en marcha

```bash
cp .env.example .env        # completar DATABASE_URL, DIRECT_URL y NEXTAUTH_SECRET
npm install                 # también genera el cliente de Prisma
npm run db:deploy           # aplica las migraciones (incluye PostGIS, CHECKs e índices GIST)
npm run db:seed             # BORRA todo y carga los datos de demo de Tucumán
npm run dev
```

Usuarios de demo (contraseña `Demo1234`): `ana@demo.test` (cliente), `carlos@demo.test` (fletero),
`admin@demo.test` (admin), `diego@demo.test` (fletero con onboarding pendiente). La lista completa
se imprime al final del seed.

## Scripts

| Script               | Qué hace                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`  | `tsc` con `strict`, `noUncheckedIndexedAccess` y `exactOptional…` |
| `npm run lint`       | ESLint (el dominio no puede importar Prisma, Next ni `lib/`)      |
| `npm test`           | Tests unitarios del dominio (Vitest)                              |
| `npm run db:migrate` | Crea una migración nueva en desarrollo                            |
| `npm run db:studio`  | Prisma Studio                                                     |

## Arquitectura

```
prisma/            schema, migraciones (SQL con PostGIS/CHECKs) y seed
src/domain/        lógica pura y testeada: geo, carga, precio, roles, catálogos
src/lib/           infraestructura de servidor: env, prisma, auth, sesión, createAction
src/features/<x>/  cada feature con sus schemas Zod, actions y componentes
src/components/    ui/ (shadcn) y shared/ (componentes reutilizables)
src/app/           rutas: (auth), cliente/, fletero/, admin/, panel/
```

- **Autorización en dos capas**: el middleware redirige por rol; cada layout, página y Server
  Action vuelve a verificar contra la base (`requireRol`, `createAction`).
- **Geo**: `baseGeo` y `origenGeo` son columnas `GENERATED` a partir de lat/lng, con índice GIST.
  En el schema llevan `@default(dbgenerated())` para que Prisma no intente modificarlas.
