-- =====================================================================
-- Fatijardins — correção da fase 1
-- Um chefe só vê as ausências da equipa enquanto tiver o perfil
-- chefe_equipa. Antes, quem deixava de ser chefe mas continuava como
-- chefe_id de uma equipa continuava a ver as ausências (incluindo baixas
-- por doença) dos membros.
-- =====================================================================
create or replace function app.equipas_chefiadas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.equipas e
  where e.chefe_id = app.colaborador_atual()
    and app.perfil_atual() = 'chefe_equipa';
$$;

revoke all on function app.equipas_chefiadas() from public;
grant execute on function app.equipas_chefiadas() to authenticated, service_role;
