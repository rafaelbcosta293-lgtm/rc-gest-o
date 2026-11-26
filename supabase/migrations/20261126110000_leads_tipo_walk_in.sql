-- Relatório comercial: os walk-ins contam-se à parte das outras leads e
-- dividem-se em três tipos — quem ia a passar, quem veio por um amigo
-- (member-get-member) e quem veio depois de ver as redes sociais.
-- Fica vazio nas leads que não são walk-in e nos walk-ins antigos (por
-- classificar).
alter table public.leads add column if not exists walk_in_tipo text;

alter table public.leads drop constraint if exists leads_walk_in_tipo_check;
alter table public.leads add constraint leads_walk_in_tipo_check
  check (walk_in_tipo is null or walk_in_tipo in ('Passagem', 'Member-get-member', 'Redes sociais'));

comment on column public.leads.walk_in_tipo is 'Tipo de walk-in: Passagem, Member-get-member ou Redes sociais (só quando walk_in = true).';
