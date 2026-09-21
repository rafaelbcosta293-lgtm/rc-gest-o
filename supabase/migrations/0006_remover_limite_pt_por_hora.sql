-- A pedido: sem limite de PTs no mesmo horário. Em vez de apagar o
-- trigger (não sabemos o nome exato dele, só o da função), esvazia-se a
-- função — deixa de bloquear seja o que for, mas o "gancho" fica no
-- lugar caso um dia se queira voltar a impor um limite (basta voltar a
-- pôr a condição aqui dentro).
create or replace function public.limite_pt_por_hora()
returns trigger
language plpgsql
as $function$
begin
  return new;
end;
$function$;
