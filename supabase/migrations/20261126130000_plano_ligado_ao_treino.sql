-- Cada plano de treino fica ligado ao treino marcado na Agenda a que
-- diz respeito — é o que permite saber, por instrutor, quantos dos
-- treinos que deu tinham plano (relatório "Avaliação de instrutores").
-- Um treino só tem um plano; apagar o evento não apaga o plano (fica
-- "sem treino associado").
alter table public.sessoes
  add column if not exists agenda_evento_id uuid references public.agenda_eventos (id) on delete set null;

create unique index if not exists sessoes_agenda_evento_id_key
  on public.sessoes (agenda_evento_id)
  where agenda_evento_id is not null;

-- O plano acompanha o treino: se o evento muda de dia, a data do plano
-- muda com ele; se o evento passa a ser de outro cliente, o plano
-- solta-se (continua na ficha do cliente a quem pertence).
create or replace function public.plano_segue_o_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is distinct from old.cliente_id then
    update sessoes set agenda_evento_id = null where agenda_evento_id = new.id;
  elsif new.data is distinct from old.data then
    update sessoes set data = new.data where agenda_evento_id = new.id and data is distinct from new.data;
  end if;
  return null;
end;
$$;

revoke execute on function public.plano_segue_o_evento() from public, anon, authenticated;

drop trigger if exists agenda_eventos_plano_segue on public.agenda_eventos;
create trigger agenda_eventos_plano_segue
  after update of data, cliente_id on public.agenda_eventos
  for each row
  when (old.data is distinct from new.data or old.cliente_id is distinct from new.cliente_id)
  execute function public.plano_segue_o_evento();

-- Planos que já existiam: ligam-se ao treino do mesmo cliente no mesmo
-- dia, quando só há um (não desmarcado). Com dois planos para o mesmo
-- treino, liga-se o que tem mais exercícios.
with candidatos as (
  select
    s.id as sessao_id,
    e.id as evento_id,
    row_number() over (
      partition by e.id
      order by (select count(*) from public.sessao_exercicios x where x.sessao_id = s.id) desc, s.criado_em
    ) as ordem_no_evento,
    count(*) over (partition by s.id) as eventos_do_plano
  from public.sessoes s
  join public.agenda_eventos e
    on e.cliente_id = s.cliente_id
   and e.data = s.data
   and e.tipo = 'Treino'
   and e.estado <> 'Cancelado'
  where s.agenda_evento_id is null
)
update public.sessoes s
set agenda_evento_id = c.evento_id
from candidatos c
where c.sessao_id = s.id
  and c.ordem_no_evento = 1
  and c.eventos_do_plano = 1;
