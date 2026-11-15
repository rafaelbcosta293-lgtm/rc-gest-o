-- Registo de Horas: um dia pode ser registado como dia de férias.
--
-- Até aqui, as férias só entravam nas contas do mês pelos pedidos
-- aprovados no mapa de férias. Agora o próprio instrutor, ao preencher
-- as horas, pode marcar o dia como férias: a linha fica sem turnos (0
-- horas) e com "ferias" a verdadeiro. Continua a valer tudo o resto —
-- uma linha por pessoa e por dia, e um mês submetido fica fechado.
alter table public.registos_horario add column if not exists ferias boolean not null default false;

-- A regra antiga exigia sempre pelo menos um turno; passa a aceitar um
-- dia sem turnos se for de férias. (O nome da regra foi gerado pela base
-- de dados, por isso procura-se pela definição.)
do $$
declare
  regra text;
begin
  select conname into regra
  from pg_constraint
  where conrelid = 'public.registos_horario'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%entrada_1 IS NOT NULL%'
    and pg_get_constraintdef(oid) not ilike '%ferias%';
  if regra is not null then
    execute format('alter table public.registos_horario drop constraint %I', regra);
  end if;
end $$;

alter table public.registos_horario drop constraint if exists registos_horario_turno_ou_ferias;
alter table public.registos_horario
  add constraint registos_horario_turno_ou_ferias check (ferias or entrada_1 is not null or entrada_2 is not null);

-- Um dia de férias não tem horas trabalhadas.
alter table public.registos_horario drop constraint if exists registos_horario_ferias_sem_turnos;
alter table public.registos_horario
  add constraint registos_horario_ferias_sem_turnos check (not ferias or (entrada_1 is null and entrada_2 is null));
