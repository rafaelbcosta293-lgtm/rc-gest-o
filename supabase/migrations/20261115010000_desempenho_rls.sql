-- Desempenho das regras de acesso (RLS), sem mudar quem vê o quê.
--
-- As regras chamavam tenho_estudio(estudio_id), e_admin(), e_gestao() e
-- meu_papel() LINHA A LINHA: cada chamada é uma função SECURITY DEFINER
-- que faz a sua própria consulta. Numa lista de 300 clientes eram
-- centenas de consultas escondidas.
--
-- Reescreve-se cada regra para a forma equivalente que o Postgres
-- calcula UMA vez por consulta:
--   e_admin()        → (SELECT e_admin())
--   tenho_estudio(x) → ((SELECT e_admin()) OR x = ANY ((SELECT estudios_acessiveis())::smallint[]))
-- (tenho_estudio(p) é, por definição, "e_admin() OR p IN meus_estudios()".)
-- O "::smallint[]" é obrigatório: sem ele o Postgres lê "= ANY (subconsulta)"
-- e compara o estúdio com a lista inteira (erro "smallint = smallint[]").
--
-- Ensaiado antes de aplicar, numa transação desfeita no fim: 65 tabelas
-- e vistas × 6 contas (dono, Fátima, Leiria, conta pessoal, Coordenação
-- e uma conta sem perfil) = 390 contagens, nenhuma diferença. A lista de
-- clientes vista pela conta de Fátima passou de 62,6 ms para 0,8 ms.

create or replace function public.estudios_acessiveis()
returns smallint[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array(select meus_estudios()), '{}'::smallint[]);
$$;

do $$
declare
  p record;
  novo_using text;
  novo_check text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(tenho_estudio|e_admin|e_gestao|meu_papel)\('
  loop
    novo_using := p.qual;
    novo_check := p.with_check;
    novo_using := regexp_replace(novo_using, '(?<!SELECT )\m(e_admin|e_gestao|meu_papel)\(\)', '(SELECT \1())', 'g');
    novo_check := regexp_replace(novo_check, '(?<!SELECT )\m(e_admin|e_gestao|meu_papel)\(\)', '(SELECT \1())', 'g');
    novo_using := regexp_replace(novo_using, '\mtenho_estudio\(([a-z_.]+)\)',
      '((SELECT e_admin()) OR \1 = ANY ((SELECT estudios_acessiveis())::smallint[]))', 'g');
    novo_check := regexp_replace(novo_check, '\mtenho_estudio\(([a-z_.]+)\)',
      '((SELECT e_admin()) OR \1 = ANY ((SELECT estudios_acessiveis())::smallint[]))', 'g');
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if novo_using is not null then
      sql := sql || format(' using (%s)', novo_using);
    end if;
    if novo_check is not null then
      sql := sql || format(' with check (%s)', novo_check);
    end if;
    execute sql;
  end loop;
end $$;

-- Chaves estrangeiras usadas em consultas e sem índice.
create index if not exists config_assiduidade_estudio_idx on public.config_assiduidade (estudio_id);
create index if not exists ferias_bloqueios_estudio_idx on public.ferias_bloqueios (estudio_id);
