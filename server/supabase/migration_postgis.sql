-- Migración aditiva: geolocalización PostGIS sobre una base ya creada.
-- Ejecutar en Supabase: SQL Editor → New query → Run.
-- No borra datos. Si partís de schema.sql nuevo, esto ya está incluido.

create extension if not exists postgis with schema extensions;

alter table public.plomeros
  add column if not exists ubicacion geography(Point, 4326);

create index if not exists plomeros_ubicacion_gix on public.plomeros using gist (ubicacion);

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

-- Backfill de puntos existentes.
update public.plomeros
set ubicacion = ST_SetSRID(
  ST_MakePoint(longitud::double precision, latitud::double precision),
  4326
)::geography
where latitud is not null
  and longitud is not null
  and ubicacion is null;

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
