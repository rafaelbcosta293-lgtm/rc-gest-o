-- Eliminar um instrutor de vez.
--
-- Muitas tabelas guardam "quem fez" (registado_por, criado_por…) com uma
-- ligação à ficha em "perfis" que impede apagar essa ficha. Esta função
-- desfaz essas ligações (o registo fica, sem o nome de quem o fez) para
-- a ficha poder ser apagada a seguir pela aplicação. O que está ligado
-- com "on delete cascade" (registo de horas, férias, avisos de horário,
-- acessos aos estúdios) desaparece com a ficha; o que está com "on
-- delete set null" (treinos da agenda, tarefas) fica sem instrutor.
--
-- Procura as ligações no catálogo em vez de as ter escritas à mão, para
-- não ficar desatualizada quando se criam tabelas novas. É tudo ou nada:
-- se houver registos que não podem ficar sem instrutor (coluna
-- obrigatória), levanta um erro e não altera nada.
--
-- Só o serviço da aplicação (chave de serviço) a pode chamar.
create or replace function public.desligar_perfil_do_historico(alvo uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n bigint;
  desligadas text[] := '{}';
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Sem permissão.';
  end if;

  for r in
    select c.conrelid::regclass::text as tabela, a.attname::text as coluna, a.attnotnull as obrigatoria
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.perfis'::regclass
      and c.confdeltype in ('a', 'r')
      and cardinality(c.conkey) = 1
    order by a.attnotnull desc
  loop
    if r.obrigatoria then
      execute format('select count(*) from %s where %I = $1', r.tabela, r.coluna) into n using alvo;
      if n > 0 then
        raise exception 'Tem % registo(s) em % que não podem ficar sem instrutor.', n, r.tabela;
      end if;
    else
      execute format('update %s set %I = null where %I = $1', r.tabela, r.coluna, r.coluna) using alvo;
      get diagnostics n = row_count;
      if n > 0 then
        desligadas := desligadas || format('%s.%s: %s', r.tabela, r.coluna, n);
      end if;
    end if;
  end loop;

  return desligadas;
end
$$;

revoke all on function public.desligar_perfil_do_historico(uuid) from public, anon, authenticated;
grant execute on function public.desligar_perfil_do_historico(uuid) to service_role;
