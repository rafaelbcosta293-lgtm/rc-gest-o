-- =====================================================================
-- Testes de permissões (RLS) e regras da fase 4: equipamentos,
-- manutenções, consumíveis, preços, movimentos e stock, e a ligação dos
-- materiais dos trabalhos ao stock. Precisa dos dados de exemplo
-- (seed.sql, com os trabalhos no dia de hoje). Corre numa transação e
-- desfaz tudo no fim (rollback). Se algum teste falhar: "FALHOU: …".
-- =====================================================================
begin;

create function pg_temp.verificar(condicao boolean, mensagem text)
returns void
language plpgsql
as $$
begin
  if condicao is distinct from true then
    raise exception 'FALHOU: %', mensagem;
  end if;
  raise notice 'ok — %', mensagem;
end;
$$;

create function pg_temp.entrar(utilizador uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', utilizador, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.recusado(sql text, mensagem text)
returns void
language plpgsql
as $$
begin
  execute sql;
  raise exception 'FALHOU: %', mensagem;
exception when insufficient_privilege or check_violation or foreign_key_violation or unique_violation then
  raise notice 'ok — %', mensagem;
end;
$$;

grant execute on function pg_temp.verificar(boolean, text) to authenticated;
grant execute on function pg_temp.entrar(uuid) to authenticated;
grant execute on function pg_temp.recusado(text, text) to authenticated;

-- Dados de exemplo: 8 equipamentos (a4…01-08; 01, 03, 04 da Equipa Verde,
-- 02 e 05 da Terra, 06 e 07 sem equipa, 08 do Tiago), 3 manutenções,
-- 9 consumíveis (a5…01-09; o 09 desativado), 8 entradas e 3 saídas.

-- ---------------------------------------------------------------------
-- Gerente
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*) from public.equipamentos) = 8, 'gerente vê os equipamentos');
select pg_temp.verificar((select count(*) from public.manutencoes_equipamento) = 3, 'gerente vê as manutenções');
select pg_temp.verificar((select count(*) from public.consumiveis) = 9, 'gerente vê todos os consumíveis');
select pg_temp.verificar((select count(*) from public.consumiveis_precos) = 9, 'gerente vê os preços');
select pg_temp.verificar((select count(*) from public.movimentos_stock) = 11, 'gerente vê os movimentos');
select pg_temp.verificar(
  (select stock = 185 from public.stock_consumiveis() where consumivel_id = 'a5000000-0000-4000-8000-000000000001'),
  'stock = entradas - saídas dos trabalhos (fio: 200 - 15)'
);
insert into public.equipamentos (nome, tipo, matricula) values ('Teste Fase4 carrinha', 'viatura', 'ZZ-99-ZZ');
select pg_temp.recusado(
  $q$insert into public.equipamentos (nome, tipo, matricula) values ('Teste Fase4 matrícula', 'viatura', 'zz9999')$q$,
  'matrícula fora do formato AA-00-AA é recusada'
);
insert into public.manutencoes_equipamento (equipamento_id, tipo, custo)
  select id, 'reparacao', 120 from public.equipamentos where nome = 'Teste Fase4 carrinha';
select pg_temp.verificar(
  (select m.colaborador_id = 'c0000000-0000-4000-8000-000000000001' from public.manutencoes_equipamento m
   join public.equipamentos e on e.id = m.equipamento_id where e.nome = 'Teste Fase4 carrinha'),
  'gerente regista manutenções (autor preenchido)'
);
insert into public.consumiveis (nome, unidade, stock_minimo) values ('Teste Fase4 artigo', 'kg', 3);
select pg_temp.recusado(
  $q$insert into public.consumiveis (nome, unidade) values ('  teste fase4 ARTIGO ', 'kg')$q$,
  'não há dois consumíveis com o mesmo nome'
);
insert into public.movimentos_stock (consumivel_id, tipo, quantidade, preco_unitario)
  select id, 'entrada', 10, 2.5 from public.consumiveis where nome = 'Teste Fase4 artigo';
select pg_temp.recusado(
  $q$insert into public.movimentos_stock (consumivel_id, tipo, quantidade)
     select id, 'entrada', -1 from public.consumiveis where nome = 'Teste Fase4 artigo'$q$,
  'uma entrada tem quantidade positiva'
);
select pg_temp.recusado(
  $q$insert into public.movimentos_stock (consumivel_id, tipo, quantidade, registo_material_id)
     select id, 'saida', -1, gen_random_uuid() from public.consumiveis where nome = 'Teste Fase4 artigo'$q$,
  'ninguém liga movimentos a materiais à mão'
);
select pg_temp.recusado(
  $q$delete from public.consumiveis where id = 'a5000000-0000-4000-8000-000000000001'$q$,
  'consumível com movimentos não se apaga (desativa-se)'
);
update public.movimentos_stock set quantidade = -1 where registo_material_id is not null;
delete from public.movimentos_stock where registo_material_id is not null;
select pg_temp.verificar(
  (select count(*) = 3 and bool_and(quantidade <= -6) from public.movimentos_stock where registo_material_id is not null),
  'as saídas dos materiais não se alteram nem apagam à mão'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Chefe da Equipa Verde (Rui)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.equipamentos) = 9, 'chefe vê os equipamentos');
select pg_temp.verificar((select count(*) from public.manutencoes_equipamento) = 0, 'chefe NÃO vê as manutenções (custos)');
select pg_temp.verificar((select count(*) from public.consumiveis_precos) = 0, 'chefe NÃO vê os preços');
select pg_temp.verificar((select count(*) from public.movimentos_stock) = 0, 'chefe NÃO vê os movimentos (preços)');
select pg_temp.verificar((select count(*) from public.stock_consumiveis()) = 10, 'chefe vê o stock de cada consumível');
update public.equipamentos set estado = 'avariado', notas = 'Teste Fase4: lâmina partida'
  where id = 'a4000000-0000-4000-8000-000000000003';
select pg_temp.verificar(
  (select estado = 'avariado' from public.equipamentos where id = 'a4000000-0000-4000-8000-000000000003'),
  'chefe marca uma avaria num equipamento da sua equipa'
);
update public.equipamentos set estado = 'avariado' where id = 'a4000000-0000-4000-8000-000000000002';
select pg_temp.verificar(
  (select estado = 'operacional' from public.equipamentos where id = 'a4000000-0000-4000-8000-000000000002'),
  'chefe NÃO mexe nos equipamentos de outra equipa'
);
update public.equipamentos set estado = 'avariado' where id = 'a4000000-0000-4000-8000-000000000006';
select pg_temp.verificar(
  (select estado = 'avariado' from public.equipamentos where id = 'a4000000-0000-4000-8000-000000000006'),
  'chefe marca avarias em equipamentos sem equipa'
);
select pg_temp.recusado(
  $q$update public.equipamentos set nome = 'Outro', equipa_id = null where id = 'a4000000-0000-4000-8000-000000000003'$q$,
  'chefe NÃO muda os dados do equipamento além do estado e das notas'
);
select pg_temp.recusado(
  $q$update public.equipamentos set estado = 'abatido' where id = 'a4000000-0000-4000-8000-000000000004'$q$,
  'chefe NÃO abate equipamentos'
);
select pg_temp.recusado(
  $q$insert into public.equipamentos (nome) values ('Teste Fase4 do chefe')$q$,
  'chefe NÃO cria equipamentos'
);
select pg_temp.recusado(
  $q$insert into public.consumiveis (nome) values ('Teste Fase4 do chefe')$q$,
  'chefe NÃO cria consumíveis'
);
select pg_temp.recusado(
  $q$insert into public.movimentos_stock (consumivel_id, tipo, quantidade) values ('a5000000-0000-4000-8000-000000000001', 'entrada', 5)$q$,
  'chefe NÃO regista movimentos à mão'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Colaborador (Tiago): só o catálogo ativo, para os materiais
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar((select count(*) from public.equipamentos) = 0, 'colaborador NÃO vê equipamentos');
select pg_temp.verificar((select count(*) from public.consumiveis) = 9, 'colaborador vê os consumíveis ativos (para os materiais)');
select pg_temp.verificar(
  (select count(*) from public.consumiveis where not ativo) = 0,
  'colaborador NÃO vê consumíveis desativados'
);
select pg_temp.verificar((select count(*) from public.consumiveis_precos) = 0, 'colaborador NÃO vê preços');
select pg_temp.verificar((select count(*) from public.movimentos_stock) = 0, 'colaborador NÃO vê movimentos');
select pg_temp.verificar((select count(*) from public.stock_consumiveis()) = 0, 'colaborador NÃO vê o stock');

-- Material gasto num trabalho de hoje ligado a um consumível → saída de stock.
insert into public.registos_trabalho (trabalho_id) values ('b0000000-0000-4000-8000-000000000001');
insert into public.registo_materiais (registo_id, descricao, quantidade, unidade, consumivel_id)
  select id, 'Composto', 3, 'kg', 'a5000000-0000-4000-8000-000000000004'
  from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select unidade = 'un' from public.registo_materiais where descricao = 'Composto'),
  'com consumível, a unidade é a do catálogo'
);
select pg_temp.recusado(
  $q$insert into public.registo_materiais (registo_id, descricao, quantidade, consumivel_id)
     select id, 'Herbicida', 1, 'a5000000-0000-4000-8000-000000000009'
     from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'consumível desativado não se usa nos materiais'
);
update public.registo_materiais set quantidade = 4 where descricao = 'Composto';
reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.verificar(
  (select m.tipo = 'saida' and m.quantidade = -4 and m.trabalho_id = 'b0000000-0000-4000-8000-000000000001'
     and m.colaborador_id = 'c0000000-0000-4000-8000-000000000004'
   from public.movimentos_stock m join public.registo_materiais r on r.id = m.registo_material_id
   where r.descricao = 'Composto'),
  'material com consumível cria a saída de stock (e acompanha a quantidade)'
);
update public.registo_materiais set consumivel_id = null where descricao = 'Composto';
select pg_temp.verificar(
  (select count(*) from public.movimentos_stock m join public.registo_materiais r on r.id = m.registo_material_id
   where r.descricao = 'Composto') = 0,
  'tirar o consumível do material apaga a saída'
);
update public.registo_materiais set consumivel_id = 'a5000000-0000-4000-8000-000000000004' where descricao = 'Composto';
delete from public.registo_materiais where descricao = 'Composto';
select pg_temp.verificar(
  (select count(*) from public.movimentos_stock where tipo = 'saida' and consumivel_id = 'a5000000-0000-4000-8000-000000000004') = 0,
  'apagar o material apaga a saída de stock'
);

rollback;
