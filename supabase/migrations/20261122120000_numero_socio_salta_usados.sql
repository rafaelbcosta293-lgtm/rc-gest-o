-- Nº de cliente automático: se o número seguinte já estiver em uso (ex.:
-- alguém escreveu à mão um número mais à frente na ficha de um cliente),
-- salta para o próximo livre em vez de falhar com "número duplicado" —
-- o que impedia criar clientes novos (ou converter leads) nesse estúdio.
create or replace function public.gerar_numero_socio()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_codigo text;
  v_numero integer;
  v_ano integer;
begin
  if new.numero_socio is not null then
    return new;
  end if;

  v_ano := extract(year from coalesce(new.inicio_contrato, current_date))::integer % 100;

  loop
    update public.estudios
      set proximo_numero_socio = proximo_numero_socio + 1
      where id = new.estudio_id
      returning codigo_socio, proximo_numero_socio - 1 into v_codigo, v_numero;

    new.numero_socio := v_codigo || lpad(v_ano::text, 2, '0') || lpad(v_numero::text, 3, '0');
    exit when not exists (select 1 from public.clientes c where c.numero_socio = new.numero_socio);
  end loop;
  return new;
end;
$function$;
