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

> El alcance es deliberadamente genérico: tarifas, reglas por tipo de carga, capacidades de
> vehículos, pagos y notificaciones quedan para completar con las especificaciones finales.

## Funcionalidades

**Clientes**
- Registro e inicio de sesión.
- Publicación de solicitudes de flete (mudanza, mueble, compra, paquete, otro).
- Carga de objetos, cantidades y fotografías (inventario).
- Búsqueda de fleteros con filtros: tipo de vehículo, precio, calificación y cercanía al origen.
- Recepción, comparación y selección de presupuestos.
- Consulta del estado del flete, confirmación de la recepción y calificación del fletero.

**Fleteros**
- Registro de perfil y datos del vehículo (moto, auto, camioneta o camión).
- Definición de zona de trabajo (ubicación + radio en km) y disponibilidad.
- Consulta de solicitudes publicadas cercanas y envío de presupuestos.
- Gestión de fletes aceptados y actualización del estado del servicio.
- Registro de los objetos cargados y entregados.

**Chat interno** — una conversación por solicitud y fletero, en tiempo real (Socket.io), con
mensajes y fotos. Se habilita solo con fleteros que cotizaron; los datos de contacto nunca se exponen.

**Inventario y seguimiento** — cada objeto registra carga y descarga con fecha; el flete no puede
salir sin registrar la carga ni marcarse entregado sin la descarga. El historial guarda cada etapa.

## Funcionamiento (estados de una solicitud)

```
publicada ──(cliente elige presupuesto)──▶ confirmada ──(fletero registra carga e inicia)──▶ en_transito
    │                                          │
    └──────────── cancelada ◀──────────────────┘
en_transito ──(fletero registra descarga)──▶ entregada ──(cliente confirma recepción)──▶ completada
```

Solo con la solicitud **completada** el cliente puede calificar al fletero, una única vez.

## Stack

- **Backend:** Node.js + Express + Socket.io, auth JWT + bcrypt. Persistencia en Supabase
  (Postgres + PostGIS) o, si no está configurado, en un archivo JSON local (`backend/data/db.json`).
- **Frontend:** React + Vite + React Router + React-Leaflet (OpenStreetMap) + Socket.io-client.

## Instalación

```bash
npm install
npm run install:all
```

Para usar Supabase, copiá `backend/.env.example` a `backend/.env`, completalo y ejecutá
`db/schema.sql` en el SQL Editor (⚠️ borra y recrea las tablas). Sin `.env` se usa el JSON local.

## Datos de demo

```bash
npm run seed
```

> ⚠️ El seed **reemplaza todos los datos** de la base configurada (Supabase o JSON local).

Usuarios de prueba (contraseña **123456**):

| Rol     | Email            | Vehículo  |
|---------|------------------|-----------|
| Cliente | ana@demo.com     | —         |
| Cliente | luis@demo.com    | —         |
| Fletero | carlos@demo.com  | Camioneta |
| Fletero | marta@demo.com   | Moto      |
| Fletero | jose@demo.com    | Camión    |
| Fletero | sole@demo.com    | Auto      |

## Ejecutar (desarrollo)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API + chat: http://localhost:4000 (Vite hace proxy de `/api` y `/socket.io`)

## Flujo de la demo

1. Entrá como **luis@demo.com** → "Mis solicitudes" → "Heladera y lavarropas": compará los dos
   presupuestos, chateá con un fletero y elegí uno.
2. Entrá como **sole@demo.com** → "Mis fletes" → "Compra del mayorista": marcá cada objeto como
   cargado, iniciá el traslado, marcá la descarga y registrá la entrega.
3. Volvé como **ana@demo.com** a esa solicitud, confirmá la recepción y calificá al fletero.
4. Como cliente, publicá un flete nuevo desde "Publicar flete"; como fletero, miralo en
   "Solicitudes cerca" y enviá un presupuesto.

## API

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | público |
| GET/PUT | `/api/auth/me` | autenticado |
| GET | `/api/fleteros?tipoVehiculo&precioMaximo&calificacionMinima&lat&lng&radioKm&orden` | público |
| GET | `/api/fleteros/:id` | público |
| PUT / PATCH | `/api/fleteros/:id`, `/api/fleteros/:id/disponibilidad` | fletero dueño |
| POST / GET | `/api/solicitudes` | cliente publica / listado propio |
| GET | `/api/solicitudes/disponibles?radioKm&tipoVehiculo` | fletero |
| GET / PUT | `/api/solicitudes/:id` | participantes / cliente (si está publicada) |
| POST | `/api/solicitudes/:id/presupuestos` | fletero |
| POST | `/api/solicitudes/:id/presupuestos/:pid/aceptar` | cliente |
| PATCH | `/api/solicitudes/:id/estado` | según transición |
| PATCH | `/api/solicitudes/:id/inventario/:itemId` | fletero asignado |
| GET | `/api/mensajes/:solicitudId/:fleteroId` | participantes del chat |
| POST | `/api/resenas` | cliente, flete completado |

## Estructura

```
backend/
  src/constants.js      catálogos: roles, vehículos, tipos de carga, estados y transiciones
  src/models/           Usuario, Fletero (búsqueda por cercanía), Solicitud (acceso y vistas)
  src/routes/           auth, fleteros, solicitudes (+ presupuestos e inventario), mensajes, resenas
  src/geo.js            distancia Haversine (fallback local de PostGIS)
  src/seed.js           datos de demo en el Gran San Miguel de Tucumán
frontend/src/
  pages/                Landing, Fleteros, FleteroPerfil, NuevaSolicitud, SolicitudDetalle,
                        SolicitudesDisponibles, MisSolicitudes, MisFletes, MiPerfilFletero, ...
  components/           MapView, MapSearchModal, ChatPanel, EstadoStepper, FotosInput, ...
  utils/catalogos.js    etiquetas de vehículos, cargas y estados
db/schema.sql           esquema Supabase/PostGIS
```
