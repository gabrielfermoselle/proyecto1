-- Schema para el backend de Oficios Validados.
-- Ejecutar en Supabase: SQL Editor → New query → Run.
-- El servidor usa la service_role key (bypasea RLS). El frontend no habla con Supabase.

create extension if not exists postgis with schema extensions;

-- Limpia tablas viejas (inglés) por si se corrió el schema anterior.
drop table if exists public.messages cascade;
drop table if exists public.reviews cascade;
drop table if exists public.jobs cascade;
drop table if exists public.plumbers cascade;
drop table if exists public.users cascade;

drop table if exists public.mensajes cascade;
drop table if exists public.resenas cascade;
drop table if exists public.trabajos cascade;
drop table if exists public.plomeros cascade;
drop table if exists public.usuarios cascade;

create table public.usuarios (
  id text primary key,
  rol text not null check (rol in ('client', 'plomero')),
  nombre text not null,
  correo text not null unique,
  hash_contrasena text not null,
  telefono text not null default '',
  creado_en timestamptz not null default now(),
  hash_token_reset text,
  token_reset_expira_en timestamptz
);

create table public.plomeros (
  id text primary key,
  usuario_id text not null unique references public.usuarios(id) on delete cascade,
  especialidad text[] not null default '{}',
  descripcion text not null default '',
  tarifa_hora numeric not null default 0,
  direccion text not null default '',
  radio_trabajo_km numeric not null default 0,
  latitud numeric,
  longitud numeric,
  ubicacion geography(Point, 4326),
  url_foto text not null default '',
  portafolio jsonb not null default '[]'::jsonb,
  disponible boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.trabajos (
  id text primary key,
  cliente_id text not null references public.usuarios(id) on delete cascade,
  plomero_id text not null references public.plomeros(id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  estado text not null check (estado in ('requested', 'accepted', 'started', 'completed', 'cancelled')),
  precio_acordado numeric,
  creado_en timestamptz not null default now(),
  completado_en timestamptz
);

create table public.resenas (
  id text primary key,
  trabajo_id text not null unique references public.trabajos(id) on delete cascade,
  plomero_id text not null references public.plomeros(id) on delete cascade,
  cliente_id text not null references public.usuarios(id) on delete cascade,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario text not null default '',
  creado_en timestamptz not null default now()
);

create table public.mensajes (
  id text primary key,
  trabajo_id text not null references public.trabajos(id) on delete cascade,
  remitente_id text not null references public.usuarios(id) on delete cascade,
  nombre_remitente text not null default '',
  cuerpo text not null,
  creado_en timestamptz not null default now()
);

create index plomeros_usuario_id_idx on public.plomeros (usuario_id);
create index plomeros_ubicacion_gix on public.plomeros using gist (ubicacion);
create index trabajos_cliente_id_idx on public.trabajos (cliente_id);
create index trabajos_plomero_id_idx on public.trabajos (plomero_id);
create index resenas_plomero_id_idx on public.resenas (plomero_id);
create index mensajes_trabajo_id_idx on public.mensajes (trabajo_id);

-- Sincroniza geography Point desde latitud/longitud en cada insert/update.
create or replace function public.sync_plomero_ubicacion()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if NEW.latitud is not null and NEW.longitud is not null then
    NEW.ubicacion := ST_SetSRID(
      ST_MakePoint(NEW.longitud::double precision, NEW.latitud::double precision),
      4326
    )::geography;
  else
    NEW.ubicacion := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_plomeros_ubicacion on public.plomeros;
create trigger trg_plomeros_ubicacion
before insert or update of latitud, longitud
on public.plomeros
for each row
execute function public.sync_plomero_ubicacion();

-- Búsqueda por proximidad: ST_DWithin filtra el radio, ST_Distance ordena.
drop function if exists public.buscar_plomeros(double precision, double precision, double precision, text, double precision, integer, integer);

create or replace function public.buscar_plomeros(
  p_lat double precision,
  p_lng double precision,
  p_radio_km double precision,
  p_especialidad text default null,
  p_calificacion_minima double precision default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id text,
  usuario_id text,
  nombre text,
  especialidad text[],
  descripcion text,
  tarifa_hora numeric,
  direccion text,
  radio_trabajo_km numeric,
  latitud numeric,
  longitud numeric,
  url_foto text,
  portafolio jsonb,
  disponible boolean,
  creado_en timestamptz,
  promedio_calificacion double precision,
  cantidad_resenas integer,
  trabajos_completados integer,
  distancia_km double precision,
  total bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origen as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as geog
  ),
  candidatos as (
    select
      p.id,
      p.usuario_id,
      u.nombre,
      p.especialidad,
      p.descripcion,
      p.tarifa_hora,
      p.direccion,
      p.radio_trabajo_km,
      p.latitud,
      p.longitud,
      p.url_foto,
      p.portafolio,
      p.disponible,
      p.creado_en,
      coalesce((
        select avg(r.calificacion)::double precision
        from public.resenas r
        where r.plomero_id = p.id
      ), 0) as promedio_calificacion,
      coalesce((
        select count(*)::integer
        from public.resenas r
        where r.plomero_id = p.id
      ), 0) as cantidad_resenas,
      coalesce((
        select count(*)::integer
        from public.trabajos t
        where t.plomero_id = p.id and t.estado = 'completed'
      ), 0) as trabajos_completados,
      (ST_Distance(p.ubicacion, o.geog) / 1000.0)::double precision as distancia_km
    from public.plomeros p
    cross join origen o
    join public.usuarios u on u.id = p.usuario_id
    where p.ubicacion is not null
      and ST_DWithin(p.ubicacion, o.geog, p_radio_km * 1000.0)
      and (
        p_especialidad is null
        or exists (
          select 1 from unnest(p.especialidad) as esp
          where lower(esp) = lower(p_especialidad)
        )
      )
  )
  select
    c.*,
    count(*) over() as total
  from candidatos c
  where p_calificacion_minima is null
     or c.promedio_calificacion >= p_calificacion_minima
  order by c.distancia_km asc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.buscar_plomeros(double precision, double precision, double precision, text, double precision, integer, integer)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

alter table public.usuarios enable row level security;
alter table public.plomeros enable row level security;
alter table public.trabajos enable row level security;
alter table public.resenas enable row level security;
alter table public.mensajes enable row level security;
