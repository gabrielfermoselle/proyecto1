-- Schema para el backend de Oficios Validados.
-- Ejecutar en Supabase: SQL Editor → New query → Run.
-- El servidor usa la service_role key (bypasea RLS). El frontend no habla con Supabase.

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
create index trabajos_cliente_id_idx on public.trabajos (cliente_id);
create index trabajos_plomero_id_idx on public.trabajos (plomero_id);
create index resenas_plomero_id_idx on public.resenas (plomero_id);
create index mensajes_trabajo_id_idx on public.mensajes (trabajo_id);

alter table public.usuarios enable row level security;
alter table public.plomeros enable row level security;
alter table public.trabajos enable row level security;
alter table public.resenas enable row level security;
alter table public.mensajes enable row level security;
