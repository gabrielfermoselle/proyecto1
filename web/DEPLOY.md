# Puesta en producción

Supabase (Postgres + Realtime + Storage) y Vercel. Lleva unos 20 minutos la primera vez.

## 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com), región **São Paulo** (la más cercana).
2. **Database → Extensions**: activar `postgis`.
3. Anotar, desde **Project Settings**:
   - **Database → Connection string**:
     - `DATABASE_URL`: el _Transaction pooler_ (puerto 6543), con `?pgbouncer=true&connection_limit=1` al final.
     - `DIRECT_URL`: el _Session pooler_ (puerto 5432). Lo usan las migraciones.
   - **API**: `SUPABASE_URL`, la `anon` key (`SUPABASE_ANON_KEY`) y la `service_role` key
     (`SUPABASE_SERVICE_ROLE_KEY`, secreta: solo va en el servidor).
   - **JWT Keys → Legacy JWT secret**: `SUPABASE_JWT_SECRET`. Firma los tokens de Realtime de cada usuario.
4. **Realtime → Settings**: desactivar _Allow public access_, así los canales solo aceptan tokens firmados.

## 2. Migraciones y datos

Desde `web/`, con un `.env` que tenga al menos `DATABASE_URL` y `DIRECT_URL` de producción:

```bash
npm run db:deploy      # aplica las migraciones: tablas, PostGIS, CHECKs, políticas de Realtime y buckets
```

Las migraciones crean los buckets `fotos-publicas` y `fotos-privadas` (solo JPEG de hasta 5 MB) y las
políticas de `realtime.messages`. **No corras `npm run db:seed` en producción: borra todo.**

Para tener un administrador, registrá una cuenta común y cambiale el rol desde **Table Editor → users**
(`rol = ADMIN`). El registro no permite elegir ese rol.

## 3. Vercel

1. **Add New → Project**, importar el repositorio y elegir **Root Directory: `web`**.
   El `vercel.json` de la raíz es de la app anterior y no se usa.
2. **Environment Variables** (Production):

   | Variable                    | Valor                                                            |
   | --------------------------- | ---------------------------------------------------------------- |
   | `DATABASE_URL`              | Transaction pooler (6543) + `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL`                | Session pooler (5432)                                            |
   | `NEXTAUTH_URL`              | `https://<tu-dominio>`                                           |
   | `NEXTAUTH_SECRET`           | `openssl rand -base64 32`                                        |
   | `SUPABASE_URL`              | Project URL                                                      |
   | `SUPABASE_ANON_KEY`         | anon key                                                         |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key                                                 |
   | `SUPABASE_JWT_SECRET`       | Legacy JWT secret                                                |
   | `CRON_SECRET`               | `openssl rand -hex 32`                                           |
   | `RESEND_API_KEY`            | Resend → API Keys (emails de recuperar contraseña)               |
   | `CORREO_REMITENTE`          | `Fletes Tucumán <no-responder@tu-dominio>` (dominio verificado)  |

3. Deploy. `web/vercel.json` programa el mantenimiento diario a las 06:00 UTC (03:00 en Tucumán):
   vence solicitudes, avisa por fletes demorados y borra fotos abandonadas. Vercel lo llama con
   `Authorization: Bearer $CRON_SECRET`; sin esa variable, el endpoint responde 401.

## 4. Verificación después del primer deploy

Con dos navegadores (uno como cliente y otro como fletero):

- [ ] Registro y login de cada rol. El fletero completa el onboarding: zona, vehículo, tarifas y una foto del vehículo.
- [ ] El cliente publica un flete con fotos. El fletero lo ve en su feed (solo con la dirección aproximada) y presupuesta.
- [ ] **Realtime:** el chat entre los dos muestra mensajes, "escribiendo…", "en línea" y el doble check sin recargar.
- [ ] El cliente acepta. El fletero avanza las etapas desde el celular (permitir la ubicación) y el cliente ve el mapa y el inventario actualizarse solos.
- [ ] Fotos en el check-in/check-out y en un reclamo; el cliente cierra con firma y califica.
- [ ] Descargar el comprobante PDF.
- [ ] **Email:** "¿Olvidaste tu contraseña?" con un email real: llega el link, permite elegir una nueva y no se puede usar dos veces.
- [ ] Como admin: resolver el reclamo y verificar al fletero.
- [ ] **Cron:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<tu-dominio>/api/cron/mantenimiento`
      responde con los contadores; sin el header, 401.

Si Realtime no conecta, la app sigue andando con consultas periódicas. En ese caso, revisá
`SUPABASE_JWT_SECRET` y que la migración `chat_interno` haya creado las políticas en `realtime.messages`.
