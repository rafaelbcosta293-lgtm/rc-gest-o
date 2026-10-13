-- =====================================================================
-- Fatijardins — fase 2: nomes dos trabalhos no mapa de horas
-- O colaborador só vê os trabalhos de hoje (RLS). No mapa mensal e no CSV
-- das horas precisa, porém, do título/cliente/local dos trabalhos onde
-- picou noutros dias. Esta função devolve SÓ esses rótulos, e só para os
-- registos de horas que a pessoa pode ver (as suas; as da equipa, se for
-- chefe; todas, se for gerente).
-- =====================================================================
create or replace function public.detalhes_trabalhos_das_horas(p_inicio date, p_fim date)
returns table (trabalho_id uuid, titulo text, cliente text, local text, data date)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.id, t.titulo, c.nome, l.nome, t.data
  from public.registos_horas r
  join public.trabalhos t on t.id = r.trabalho_id
  join public.clientes c on c.id = t.cliente_id
  join public.locais l on l.id = t.local_id
  where p_fim - p_inicio <= 62
    and (r.entrada at time zone 'Europe/Lisbon')::date between p_inicio and p_fim
    and (
      app.e_gerente()
      or r.colaborador_id = app.colaborador_atual()
      or exists (
        select 1
        from public.colaboradores co
        where co.id = r.colaborador_id
          and co.equipa_id in (select app.equipas_chefiadas())
      )
    );
$$;

revoke all on function public.detalhes_trabalhos_das_horas(date, date) from public, anon;
grant execute on function public.detalhes_trabalhos_das_horas(date, date) to authenticated, service_role;
