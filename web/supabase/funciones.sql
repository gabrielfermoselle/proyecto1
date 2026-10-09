-- Funciones que la app llama con la service role. No las puede ejecutar anon ni authenticated.

create or replace function public.consumir_limite(p_clave text, p_ventana timestamp)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  insert into limites_tasa (clave, ventana, cantidad)
  values (p_clave, p_ventana, 1)
  on conflict (clave, ventana) do update set cantidad = limites_tasa.cantidad + 1
  returning cantidad into total;
  return total;
end;
$$;

revoke all on function public.consumir_limite(text, timestamp) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, timestamp) to service_role;

create or replace function public.consulta_json(p_sql text, p_params jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  q text := p_sql;
  limpio text := regexp_replace(coalesce(p_sql, ''), '^[[:space:]]+', '');
  i int := coalesce(jsonb_array_length(p_params), 0);
  v jsonb;
  lit text;
begin
  if limpio = '' then
    raise exception 'consulta vacia';
  end if;
  if limpio !~* '^select' then
    raise exception 'solo select';
  end if;
  if regexp_replace(limpio, ';[[:space:]]*$', '') ~ ';' then
    raise exception 'una sola sentencia';
  end if;

  while i >= 1 loop
    v := p_params -> (i - 1);
    if v is null or jsonb_typeof(v) = 'null' then
      lit := 'NULL';
    elsif jsonb_typeof(v) = 'number' or jsonb_typeof(v) = 'boolean' then
      lit := v #>> '{}';
    elsif jsonb_typeof(v) = 'string' then
      lit := quote_literal(v #>> '{}');
    else
      lit := quote_literal(v #>> '{}') || '::jsonb';
    end if;
    q := replace(q, '$#' || lpad(i::text, 3, '0') || '#', lit);
    i := i - 1;
  end loop;

  execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (' || q || ') t' into v;
  return v;
end;
$$;

revoke all on function public.consulta_json(text, jsonb) from public, anon, authenticated;
grant execute on function public.consulta_json(text, jsonb) to service_role;
