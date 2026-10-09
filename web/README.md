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

Para producción, ver [DEPLOY.md](DEPLOY.md).

Usuarios de demo (contraseña `Demo1234`): `ana@demo.test` (cliente), `carlos@demo.test` (fletero),
`admin@demo.test` (admin), `diego@demo.test` (fletero con onboarding pendiente). La lista completa
se imprime al final del seed.

## Scripts

| Script                          | Qué hace                                                          |
| ------------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`             | `tsc` con `strict`, `noUncheckedIndexedAccess` y `exactOptional…` |
| `npm run lint`                  | ESLint (el dominio no puede importar Prisma, Next ni `lib/`)      |
| `npm test`                      | Todos los tests: unitarios y de integración con base real         |
| `npx vitest run --project unit` | Solo los unitarios (dominio, SQL con PGlite)                      |
| `npx vitest run --project db`   | Acciones con Prisma contra PGlite + PostGIS por TCP               |
| `npm run test:e2e`              | e2e con Playwright: la app real con el seed, escritorio y móvil   |
| `npm run db:migrate`            | Crea una migración nueva en desarrollo                            |
| `npm run db:studio`             | Prisma Studio                                                     |

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
- **Ciclo del flete**: `domain/ciclo-flete.ts` define las etapas (SOLICITADO → PRESUPUESTADO →
  CONFIRMADO → EN_CAMINO_A_ORIGEN → CARGANDO → EN_TRASLADO → DESCARGANDO → ENTREGADO → CERRADO, más
  CANCELADO), quién mueve cada una y sus condiciones. Las dos primeras se derivan de la solicitud;
  desde CONFIRMADO la etapa se guarda en el flete. Todo cambio pasa por `features/fletes/servicio.ts`:
  una transacción que bloquea el flete, revalida con el dominio, guarda el historial (con la
  ubicación opcional del fletero), deja el mensaje en el chat y avisa en vivo después del commit.
- **Inventario digital**: un control por ítem y fase (check-in al cargar, check-out al descargar,
  recepción del cliente), con observación y foto opcionales, reclamos y firmas de conformidad. El
  comprobante PDF sale de `/api/fletes/[id]/comprobante` (`@react-pdf/renderer`).
- **Supabase (opcional)**: Realtime para el chat y el seguimiento en vivo, y Storage para las fotos.
  Sin las variables `SUPABASE_*`, todo funciona con consultas periódicas y sin carga de fotos.
- **Áreas**: el cliente publica solicitudes, compara presupuestos y sigue sus fletes; el fletero
  presupuesta y opera el flete desde el celular; el admin gestiona cuentas, verifica fleteros y
  resuelve reclamos.
- **Mantenimiento diario** (`features/mantenimiento`, cron en el `vercel.json` de la raíz): vence solicitudes,
  avisa por fletes demorados, borra fotos abandonadas (cada subida firmada queda registrada como
  pendiente hasta que se adjunta) y limpia el limitador.
- **Tests de integración** (`*.db.test.ts`): `test/db/global-setup.ts` levanta PGlite + PostGIS con
  todas las migraciones y lo expone por TCP; la sesión de NextAuth se simula en `test/db/sesion.ts`.
  Con `TEST_DATABASE_URL` (una base local cuyo nombre incluya `test`) corren contra un Postgres real,
  como en el CI: así también corren los tests de concurrencia, que PGlite no reproduce.
  `src/lib/autorizacion.db.test.ts` prueba cada Server Action sin sesión, con cada rol prohibido y
  sobre recursos ajenos; una acción nueva que no se sume ahí hace fallar la suite.
- **e2e** (`e2e/`): Playwright levanta `test/e2e/servidor.ts` (PGlite + seed de demo + Next) y
  recorre el ciclo completo de un flete con dos navegadores, el acceso por rol, el registro y la
  accesibilidad con axe (WCAG 2.1 AA). La primera vez: `npx playwright install chromium`.
- **CI** (`.github/workflows/web.yml`): lint, tipos y unitarios; integración contra PostGIS; e2e
  sobre el build de producción.
