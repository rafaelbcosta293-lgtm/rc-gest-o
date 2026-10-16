-- =====================================================================
-- Testes de permissões (RLS) e regras da fase 3: visitas, orçamentos,
-- linhas, dados da empresa, conversão em trabalho e fotos de visitas.
-- Precisa dos dados de exemplo (seed.sql). Corre numa transação e
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

-- Espera um erro (permissão, regra ou restrição) ao correr o SQL indicado.
create function pg_temp.recusado(sql text, mensagem text)
returns void
language plpgsql
as $$
begin
  execute sql;
  raise exception 'FALHOU: %', mensagem;
exception when insufficient_privilege or check_violation or foreign_key_violation or no_data_found then
  raise notice 'ok — %', mensagem;
end;
$$;

grant execute on function pg_temp.verificar(boolean, text) to authenticated;
grant execute on function pg_temp.entrar(uuid) to authenticated;
grant execute on function pg_temp.recusado(text, text) to authenticated;

-- Orçamentos de exemplo: a3…01 aceite, a3…02 enviado, a3…03 rascunho (do
-- chefe Rui), a3…04 recusado. Visitas a2…01 (passada) e a2…02 (futura).

-- ---------------------------------------------------------------------
-- Gerente (Marta)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*) from public.visitas) = 2, 'gerente vê as visitas');
select pg_temp.verificar((select count(*) from public.orcamentos) = 4, 'gerente vê os orçamentos');
select pg_temp.verificar((select count(*) from public.empresa) = 1, 'gerente vê os dados da empresa');
select pg_temp.verificar(
  (select total = 1450.25 and subtotal = 1215.00 and total_iva = 235.25
   from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000001'),
  'totais calculados pela BD com IVA por taxa (23% e 6%)'
);

insert into public.orcamentos (local_id, titulo)
  select l.id, 'Teste Fase3 orçamento' from public.locais l join public.clientes c on c.id = l.cliente_id
  where c.nome = 'Helena Marques' limit 1;
select pg_temp.verificar(
  (select estado = 'rascunho' and numero = (select max(numero) from public.orcamentos where ano = o.ano)
     and validade = data + 30 and criado_por = 'c0000000-0000-4000-8000-000000000001'
     and cliente_id is not null and total = 0
   from public.orcamentos o where titulo = 'Teste Fase3 orçamento'),
  'orçamento novo: rascunho, número seguinte, validade da empresa, cliente e autor preenchidos'
);
insert into public.orcamento_linhas (orcamento_id, tipo, descricao, quantidade, unidade, preco_unitario)
  select id, 'mao_de_obra', 'Corte', 3, 'h', 33.33 from public.orcamentos where titulo = 'Teste Fase3 orçamento';
insert into public.orcamento_linhas (orcamento_id, tipo, descricao, quantidade, unidade, preco_unitario, taxa_iva)
  select id, 'material', 'Plantas', 2.5, 'un', 4.01, 6 from public.orcamentos where titulo = 'Teste Fase3 orçamento';
select pg_temp.verificar(
  (select subtotal = 110.02 and total_iva = 23.60 and total = 133.62
   from public.orcamentos where titulo = 'Teste Fase3 orçamento'),
  'linhas novas atualizam os totais (99,99 + 10,03; IVA 23,00 + 0,60)'
);
select pg_temp.recusado(
  $q$update public.orcamentos set total = 1 where titulo = 'Teste Fase3 orçamento'$q$,
  'ninguém escreve os totais à mão'
);
select pg_temp.recusado(
  $q$update public.orcamentos set numero = 999 where titulo = 'Teste Fase3 orçamento'$q$,
  'ninguém muda o número do orçamento'
);
select pg_temp.recusado(
  $q$update public.orcamentos set estado = 'aceite' where titulo = 'Teste Fase3 orçamento'$q$,
  'rascunho não passa diretamente a aceite'
);

update public.orcamentos set estado = 'enviado' where titulo = 'Teste Fase3 orçamento';
select pg_temp.verificar(
  (select estado = 'enviado' and enviado_em is not null from public.orcamentos where titulo = 'Teste Fase3 orçamento'),
  'gerente envia o orçamento (data de envio registada)'
);
select pg_temp.recusado(
  $q$update public.orcamentos set titulo = 'Outro' where titulo = 'Teste Fase3 orçamento'$q$,
  'orçamento enviado não se altera'
);
select pg_temp.recusado(
  $q$insert into public.orcamento_linhas (orcamento_id, descricao, quantidade, preco_unitario)
     select id, 'Extra', 1, 1 from public.orcamentos where titulo = 'Teste Fase3 orçamento'$q$,
  'não se juntam linhas a um orçamento enviado'
);
update public.orcamento_linhas set preco_unitario = 1
  where orcamento_id = (select id from public.orcamentos where titulo = 'Teste Fase3 orçamento');
select pg_temp.verificar(
  (select total = 133.62 from public.orcamentos where titulo = 'Teste Fase3 orçamento'),
  'linhas de um orçamento enviado não mudam'
);
update public.orcamentos set notas_internas = 'Ligar na sexta' where titulo = 'Teste Fase3 orçamento';
select pg_temp.verificar(
  (select notas_internas = 'Ligar na sexta' from public.orcamentos where titulo = 'Teste Fase3 orçamento'),
  'as notas internas mudam em qualquer estado'
);
update public.orcamentos set estado = 'rascunho' where titulo = 'Teste Fase3 orçamento';
select pg_temp.verificar(
  (select estado = 'rascunho' and enviado_em is null from public.orcamentos where titulo = 'Teste Fase3 orçamento'),
  'gerente volta a pôr em rascunho para corrigir'
);

insert into public.orcamentos (local_id, titulo)
  select local_id, 'Teste Fase3 vazio' from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000001';
select pg_temp.recusado(
  $q$update public.orcamentos set estado = 'enviado' where titulo = 'Teste Fase3 vazio'$q$,
  'orçamento sem linhas não se envia'
);

-- Conversão em trabalho
select pg_temp.recusado(
  $q$select public.converter_orcamento('a3000000-0000-4000-8000-000000000002', current_date, null)$q$,
  'orçamento enviado (ainda não aceite) não se converte'
);
select public.converter_orcamento(
  'a3000000-0000-4000-8000-000000000001', current_date + 7, 'e0000000-0000-4000-8000-000000000001', 'obra', '09:00'
);
select pg_temp.verificar(
  (select t.origem = 'orcamento' and t.tipo = 'obra' and t.equipa_id = 'e0000000-0000-4000-8000-000000000001'
     and t.data = current_date + 7 and t.hora_inicio = '09:00' and t.titulo = o.titulo
     and t.local_id = o.local_id and t.descricao like '%• Abertura de vala%'
   from public.orcamentos o join public.trabalhos t on t.id = o.trabalho_id
   where o.id = 'a3000000-0000-4000-8000-000000000001' and t.orcamento_id = o.id),
  'gerente converte o orçamento aceite num trabalho (com local, equipa, dia e tarefas)'
);
select pg_temp.recusado(
  $q$select public.converter_orcamento('a3000000-0000-4000-8000-000000000001', current_date, null)$q$,
  'um orçamento só se converte uma vez'
);
select pg_temp.recusado(
  $q$update public.orcamentos set estado = 'enviado' where id = 'a3000000-0000-4000-8000-000000000001'$q$,
  'orçamento já convertido não volta atrás'
);
delete from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select count(*) from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000001') = 1,
  'orçamento aceite não se apaga'
);
delete from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000004';
select pg_temp.verificar(
  (select count(*) from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000004') = 0,
  'gerente apaga um orçamento recusado (e as linhas)'
);
select pg_temp.recusado(
  $q$delete from public.clientes where nome = 'Margarida Coelho'$q$,
  'cliente com orçamentos e visitas não se apaga'
);
insert into public.orcamentos (local_id, titulo)
  select local_id, 'Teste Fase3 número A' from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000002';
delete from public.orcamentos where titulo = 'Teste Fase3 número A';
insert into public.orcamentos (local_id, titulo)
  select local_id, 'Teste Fase3 número B' from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000002';
select pg_temp.verificar(
  (select numero = (select max(numero) from public.orcamentos o2 where o2.ano = o.ano and o2.titulo <> 'Teste Fase3 número B') + 2
   from public.orcamentos o where titulo = 'Teste Fase3 número B'),
  'o número de um orçamento apagado não volta a ser usado'
);
update public.empresa set nif = '509999999', validade_orcamento_dias = 45;
select pg_temp.verificar((select validade_orcamento_dias = 45 from public.empresa), 'gerente altera os dados da empresa');
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Chefe da Equipa Verde (Rui)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.visitas) = 2, 'chefe vê as visitas');
select pg_temp.verificar((select count(*) from public.orcamentos) >= 3, 'chefe vê os orçamentos');
select pg_temp.verificar((select count(*) from public.empresa) = 1, 'chefe vê os dados da empresa (para o PDF)');
update public.empresa set validade_orcamento_dias = 7;
select pg_temp.verificar((select validade_orcamento_dias = 45 from public.empresa), 'chefe NÃO altera os dados da empresa');

insert into public.visitas (local_id, data, notas, criado_por)
  select local_id, current_date, 'Teste Fase3 visita', 'c0000000-0000-4000-8000-000000000001'
  from public.visitas where id = 'a2000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select criado_por = 'c0000000-0000-4000-8000-000000000002' and responsavel_id = 'c0000000-0000-4000-8000-000000000002'
     and cliente_id is not null
   from public.visitas where notas = 'Teste Fase3 visita'),
  'chefe cria visitas (autor é sempre quem cria)'
);

insert into public.orcamentos (local_id, titulo, visita_id)
  select local_id, 'Teste Fase3 rascunho do chefe', id from public.visitas where notas = 'Teste Fase3 visita';
insert into public.orcamento_linhas (orcamento_id, descricao, quantidade, unidade, preco_unitario)
  select id, 'Mão de obra', 4, 'h', 25 from public.orcamentos where titulo = 'Teste Fase3 rascunho do chefe';
select pg_temp.verificar(
  (select total = 123.00 and criado_por = 'c0000000-0000-4000-8000-000000000002'
   from public.orcamentos where titulo = 'Teste Fase3 rascunho do chefe'),
  'chefe cria rascunhos de orçamento com linhas'
);
select pg_temp.recusado(
  $q$insert into public.orcamentos (local_id, titulo, estado)
     select local_id, 'Teste Fase3 enviado', 'enviado' from public.visitas limit 1$q$,
  'chefe não cria orçamentos já enviados'
);
select pg_temp.recusado(
  $q$update public.orcamentos set estado = 'enviado' where titulo = 'Teste Fase3 rascunho do chefe'$q$,
  'chefe NÃO envia orçamentos'
);
update public.orcamentos set notas_internas = 'mexido pelo chefe' where id = 'a3000000-0000-4000-8000-000000000002';
select pg_temp.verificar(
  (select notas_internas is distinct from 'mexido pelo chefe' from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000002'),
  'chefe NÃO altera orçamentos enviados'
);
select pg_temp.recusado(
  $q$select public.converter_orcamento('a3000000-0000-4000-8000-000000000001', current_date, null)$q$,
  'chefe NÃO converte orçamentos em trabalhos'
);
delete from public.orcamentos where titulo = 'Teste Fase3 orçamento';
select pg_temp.verificar(
  (select count(*) from public.orcamentos where titulo = 'Teste Fase3 orçamento') = 1,
  'chefe NÃO apaga rascunhos de outras pessoas'
);
delete from public.orcamentos where titulo = 'Teste Fase3 rascunho do chefe';
select pg_temp.verificar(
  (select count(*) from public.orcamentos where titulo = 'Teste Fase3 rascunho do chefe') = 0,
  'chefe apaga os seus rascunhos'
);

update public.trabalhos set orcamento_id = 'a3000000-0000-4000-8000-000000000002', origem = 'orcamento'
  where id = 'b0000000-0000-4000-8000-000000000009';
select pg_temp.verificar(
  (select orcamento_id is null from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000009'),
  'chefe NÃO liga trabalhos a orçamentos (só a conversão o faz)'
);
insert into public.trabalhos (local_id, titulo, data, equipa_id, orcamento_id)
  select local_id, 'Teste Fase3 trabalho ligado', current_date, 'e0000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002'
  from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select orcamento_id is null from public.trabalhos where titulo = 'Teste Fase3 trabalho ligado'),
  'trabalho novo não nasce ligado a um orçamento'
);

-- Fotos de visitas (tabela e Storage)
insert into public.fotos (visita_id, caminho)
  values ('a2000000-0000-4000-8000-000000000001', 'visitas/a2000000-0000-4000-8000-000000000001/teste.jpg');
select pg_temp.verificar(
  (select count(*) from public.fotos where visita_id = 'a2000000-0000-4000-8000-000000000001') = 1,
  'chefe junta fotos a uma visita'
);
select pg_temp.recusado(
  $q$insert into public.fotos (visita_id, caminho)
     values ('a2000000-0000-4000-8000-000000000001', 'visitas/a2000000-0000-4000-8000-000000000002/isco.jpg')$q$,
  'foto de visita só aponta para a pasta da própria visita'
);
select pg_temp.recusado(
  $q$insert into public.fotos (visita_id, trabalho_id, caminho)
     values ('a2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'visitas/a2000000-0000-4000-8000-000000000001/dois.jpg')$q$,
  'uma foto é de um trabalho ou de uma visita, não das duas'
);
insert into storage.objects (bucket_id, name, owner_id)
  values ('fotos', 'visitas/a2000000-0000-4000-8000-000000000001/teste.jpg', 'a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar(
  (select count(*) from storage.objects where name like 'visitas/%') = 1,
  'chefe envia fotos para a pasta da visita'
);
select pg_temp.recusado(
  $q$insert into storage.objects (bucket_id, name) values ('fotos', 'visitas/a2ffffff-0000-4000-8000-000000000009/x.jpg')$q$,
  'não se enviam ficheiros para visitas que não existem'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Colaborador (Tiago): não vê visitas, orçamentos nem valores
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar((select count(*) from public.visitas) = 0, 'colaborador NÃO vê visitas');
select pg_temp.verificar((select count(*) from public.orcamentos) = 0, 'colaborador NÃO vê orçamentos');
select pg_temp.verificar((select count(*) from public.orcamento_linhas) = 0, 'colaborador NÃO vê linhas de orçamento');
select pg_temp.verificar((select count(*) from public.empresa) = 0, 'colaborador NÃO vê os dados da empresa');
select pg_temp.verificar(
  (select count(*) from public.fotos where visita_id is not null) = 0,
  'colaborador NÃO vê fotos de visitas'
);
select pg_temp.verificar(
  (select count(*) from storage.objects where name like 'visitas/%') = 0,
  'colaborador NÃO vê ficheiros de visitas'
);
select pg_temp.recusado(
  $q$insert into public.visitas (local_id, data)
     select id, current_date from public.locais limit 1$q$,
  'colaborador NÃO cria visitas'
);
select pg_temp.recusado(
  $q$select public.converter_orcamento('a3000000-0000-4000-8000-000000000002', current_date, null)$q$,
  'colaborador NÃO converte orçamentos'
);
select pg_temp.recusado(
  $q$insert into storage.objects (bucket_id, name) values ('fotos', 'visitas/a2000000-0000-4000-8000-000000000001/x.jpg')$q$,
  'colaborador NÃO envia fotos de visitas'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Apagar visitas com orçamentos já enviados e colaboradores que criaram
-- visitas ou orçamentos
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
delete from public.fotos where visita_id = 'a2000000-0000-4000-8000-000000000001';
delete from public.visitas where id = 'a2000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select count(*) from public.visitas where id = 'a2000000-0000-4000-8000-000000000001') = 0
  and (select visita_id is null and estado = 'aceite' from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000001'),
  'gerente apaga uma visita com orçamento aceite (o orçamento fica sem visita)'
);
reset role;
select set_config('request.jwt.claims', '', true);

insert into public.colaboradores (id, nome, funcao, perfil)
  values ('c0000000-0000-4000-8000-0000000000f3', 'Teste Fase3 chefe a apagar', 'Chefe', 'chefe_equipa');
insert into public.visitas (local_id, data, criado_por)
  select local_id, current_date, 'c0000000-0000-4000-8000-0000000000f3'
  from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000002';
insert into public.orcamentos (local_id, titulo, criado_por)
  select local_id, 'Teste Fase3 do chefe a apagar', 'c0000000-0000-4000-8000-0000000000f3'
  from public.orcamentos where id = 'a3000000-0000-4000-8000-000000000002';
delete from public.colaboradores where id = 'c0000000-0000-4000-8000-0000000000f3';
select pg_temp.verificar(
  (select criado_por is null from public.orcamentos where titulo = 'Teste Fase3 do chefe a apagar'),
  'apagar um colaborador que criou visitas e orçamentos deixa-os sem autor'
);

rollback;
