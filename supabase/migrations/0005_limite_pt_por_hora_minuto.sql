-- limite_pt_por_hora contava quantos PTs já estavam marcados por
-- (estudio_id, data, hora), sem olhar para o minuto — juntava os turnos
-- das :00 e das :30 no mesmo limite de 3, quando deviam ser contados em
-- separado (são blocos independentes desde que a escala passou a
-- meia-hora na migração 0002). Passa a contar por
-- (estudio_id, data, hora, minuto).
--
-- O limite em si mantém-se em 3 por bloco — só a contagem estava errada.
-- Se quiseres outro número, é só mudar o "3" aqui.
create or replace function public.limite_pt_por_hora()
returns trigger
language plpgsql
as $function$
begin
  if (select count(*) from escalas
      where estudio_id = new.estudio_id
        and data = new.data
        and hora = new.hora
        and minuto = new.minuto) >= 3 then
    raise exception 'Máximo de 3 PTs no mesmo horário (%, %h%s)',
      new.data, new.hora, lpad(new.minuto::text, 2, '0');
  end if;
  return new;
end;
$function$;
