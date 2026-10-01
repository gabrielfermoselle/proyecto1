-- Schema de la Plataforma de Fletes (Tucumán).
-- Ejecutar en Supabase: SQL Editor → New query → Run.
-- El servidor usa la service_role key (bypasea RLS). El frontend no habla con Supabase.
-- Las columnas son el snake_case de los campos del backend (clienteId → cliente_id).

create extension if not exists postgis with schema extensions;

-- Limpia el esquema anterior (directorio de oficios) si existe.
drop function if exists public.buscar_plomeros(double precision, double precision, double precision, text, double precision, integer, integer);
drop table if exists public.mensajes cascade;
drop table if exists public.resenas cascade;
drop table if exists public.trabajos cascade;
drop table if exists public.plomeros cascade;
drop table if exists public.presupuestos cascade;
drop table if exists public.solicitudes cascade;
drop table if exists public.fleteros cascade;
drop table if exists public.usuarios cascade;

create table public.usuarios (
  id text primary key,
  rol text not null check (rol in ('cliente', 'fletero')),
  nombre text not null,
  correo text not null unique,
  hash_contrasena text not null,
  telefono text not null default '',
  creado_en timestamptz not null default now(),
  hash_token_reset text,
  token_reset_expira_en timestamptz
);

-- Perfil del fletero + su vehículo y zona de trabajo.
create table public.fleteros (
  id text primary key,
  usuario_id text not null unique references public.usuarios(id) on delete cascade,
  tipo_vehiculo text not null check (tipo_vehiculo in ('moto', 'auto', 'camioneta', 'camion')),
  vehiculo_descripcion text not null default '',
  capacidad_kg numeric,
  descripcion text not null default '',
  tarifa_base numeric not null default 0,
  direccion text not null default '',
  latitud numeric,
  longitud numeric,
  ubicacion geography(Point, 4326),
  radio_trabajo_km numeric not null default 10,
  foto_url text not null default '',
  foto_vehiculo_url text not null default '',
  disponible boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Solicitud de flete publicada por un cliente.
create table public.solicitudes (
  id text primary key,
  cliente_id text not null references public.usuarios(id) on delete cascade,
  titulo text not null,
  tipo_carga text not null check (tipo_carga in ('mudanza', 'mueble', 'compra', 'paquete', 'otro')),
  descripcion text not null default '',
  origen_direccion text not null default '',
  origen_lat numeric not null,
  origen_lng numeric not null,
  origen_ubicacion geography(Point, 4326),
  destino_direccion text not null default '',
  destino_lat numeric not null,
  destino_lng numeric not null,
  fecha timestamptz,
  tipo_vehiculo text check (tipo_vehiculo in ('moto', 'auto', 'camioneta', 'camion')),
  fotos jsonb not null default '[]'::jsonb,
  -- [{ id, nombre, cantidad, fotoUrl, cargado, cargadoEn, entregado, entregadoEn }]
  inventario jsonb not null default '[]'::jsonb,
  estado text not null check (estado in ('publicada', 'confirmada', 'en_transito', 'entregada', 'completada', 'cancelada')),
  fletero_id text references public.fleteros(id) on delete set null,
  presupuesto_id text,
  precio_acordado numeric,
  -- [{ estado, fecha, usuarioId }]: seguimiento por etapas
  historial jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  completada_en timestamptz
);

create table public.presupuestos (
  id text primary key,
  solicitud_id text not null references public.solicitudes(id) on delete cascade,
  fletero_id text not null references public.fleteros(id) on delete cascade,
  monto numeric not null check (monto > 0),
  mensaje text not null default '',
  estado text not null check (estado in ('pendiente', 'aceptado', 'rechazado')),
  creado_en timestamptz not null default now(),
  unique (solicitud_id, fletero_id)
);

-- Chat interno: una conversación por (solicitud, fletero).
create table public.mensajes (
  id text primary key,
  solicitud_id text not null references public.solicitudes(id) on delete cascade,
  fletero_id text not null references public.fleteros(id) on delete cascade,
  remitente_id text not null references public.usuarios(id) on delete cascade,
  remitente_nombre text not null default '',
  cuerpo text not null default '',
  imagen_url text not null default '',
  creado_en timestamptz not null default now()
);

create table public.resenas (
  id text primary key,
  solicitud_id text not null unique references public.solicitudes(id) on delete cascade,
  fletero_id text not null references public.fleteros(id) on delete cascade,
  cliente_id text not null references public.usuarios(id) on delete cascade,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario text not null default '',
  creado_en timestamptz not null default now()
);

create index fleteros_ubicacion_gix on public.fleteros using gist (ubicacion);
create index solicitudes_origen_gix on public.solicitudes using gist (origen_ubicacion);
create index solicitudes_cliente_id_idx on public.solicitudes (cliente_id);
create index solicitudes_fletero_id_idx on public.solicitudes (fletero_id);
create index solicitudes_estado_idx on public.solicitudes (estado);
create index presupuestos_solicitud_id_idx on public.presupuestos (solicitud_id);
create index presupuestos_fletero_id_idx on public.presupuestos (fletero_id);
create index mensajes_conversacion_idx on public.mensajes (solicitud_id, fletero_id);
create index resenas_fletero_id_idx on public.resenas (fletero_id);

-- Sincroniza los geography Point desde latitud/longitud en cada insert/update.
create or replace function public.sync_fletero_ubicacion()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if NEW.latitud is not null and NEW.longitud is not null then
    NEW.ubicacion := ST_SetSRID(ST_MakePoint(NEW.longitud::float8, NEW.latitud::float8), 4326)::geography;
  else
    NEW.ubicacion := null;
  end if;
  return NEW;
end;
$$;

create trigger trg_fleteros_ubicacion
before insert or update of latitud, longitud on public.fleteros
for each row execute function public.sync_fletero_ubicacion();

create or replace function public.sync_solicitud_origen()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  NEW.origen_ubicacion := ST_SetSRID(ST_MakePoint(NEW.origen_lng::float8, NEW.origen_lat::float8), 4326)::geography;
  return NEW;
end;
$$;

create trigger trg_solicitudes_origen
before insert or update of origen_lat, origen_lng on public.solicitudes
for each row execute function public.sync_solicitud_origen();

-- Fleteros dentro de un radio: ST_DWithin filtra, ST_Distance ordena.
-- El resto de los filtros (vehículo, precio, calificación) se aplica en el backend.
create or replace function public.buscar_fleteros(
  p_lat double precision,
  p_lng double precision,
  p_radio_km double precision
)
returns table (id text, distancia_km double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origen as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as geog
  )
  select f.id, (ST_Distance(f.ubicacion, o.geog) / 1000.0)::double precision as distancia_km
  from public.fleteros f
  cross join origen o
  where f.ubicacion is not null
    and ST_DWithin(f.ubicacion, o.geog, p_radio_km * 1000.0)
  order by distancia_km asc;
$$;

grant execute on function public.buscar_fleteros(double precision, double precision, double precision)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

alter table public.usuarios enable row level security;
alter table public.fleteros enable row level security;
alter table public.solicitudes enable row level security;
alter table public.presupuestos enable row level security;
alter table public.mensajes enable row level security;
alter table public.resenas enable row level security;
