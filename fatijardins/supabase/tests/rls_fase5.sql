-- =====================================================================
-- Testes de permissões (RLS) e regras da fase 5: contratos, geração
-- automática das visitas e das cobranças, cobranças, pagamentos e
-- dívidas. Precisa dos dados de exemplo (seed.sql). Corre numa transação
-- e desfaz tudo no fim (rollback). Se algum teste falhar: "FALHOU: …".
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

-- Dados de exemplo: 3 contratos (a6…01 semanal e a6…02 quinzenal da Equipa
-- Verde, a6…03 mensal da Equipa Terra) com 14 visitas geradas; 14
-- cobranças (12 dos contratos, a7…01 do orçamento e a7…02 avulsa); 11
-- pagamentos; 3 clientes com dívida (1 679,73 €).

-- ---------------------------------------------------------------------
-- Gerente
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*) from public.contratos) = 3, 'gerente vê os contratos');
select pg_temp.verificar((select count(*) from public.trabalhos where contrato_id is not null) = 14, 'os contratos geraram as visitas (8 semanas)');
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id is not null and data <= current_date) = 0,
  'as visitas geradas pelos contratos de exemplo são todas futuras'
);
select pg_temp.verificar((select count(*) from public.cobrancas) = 14, 'gerente vê as cobranças');
select pg_temp.verificar((select count(*) from public.pagamentos) = 11, 'gerente vê os pagamentos');
select pg_temp.verificar(
  (select count(*) = 3 and sum(em_divida) = 1679.73 from public.dividas_clientes),
  'dívidas por cliente (3 clientes, 1 679,73 €)'
);
select pg_temp.verificar(
  (select estado = 'atrasada' and em_divida = 253.50 from public.cobrancas_com_saldo
   where contrato_id = 'a6000000-0000-4000-8000-000000000001' and periodo = date_trunc('month', current_date) - interval '1 month'),
  'cobrança paga em parte e vencida fica atrasada'
);
select pg_temp.verificar((select count(*) from public.gerar_contratos() where trabalhos = 0 and cobrancas = 0) = 1,
  'gerar outra vez não repete visitas nem cobranças');

-- Contrato novo: visitas desde hoje (inclusive) e a cobrança deste mês.
insert into public.contratos (local_id, titulo, frequencia, equipa_id, data_inicio, valor_mensal, dia_cobranca)
select l.id, 'Teste Fase5 avença', 'semanal',
  'e0000000-0000-4000-8000-000000000002', current_date, 60, 8
from public.locais l where l.nome = 'Pátio e terraço';
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')) = 9,
  'contrato novo cria as visitas das próximas 8 semanas'
);
select pg_temp.verificar(
  (select count(*) = 1 and min(valor) = 73.80 and min(data_vencimento) = greatest(current_date, make_date(extract(year from current_date)::int, extract(month from current_date)::int, 8))
   from public.cobrancas where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')),
  'contrato novo cria a cobrança do mês (com IVA, vence no dia do contrato ou hoje)'
);
select pg_temp.verificar(
  (select cliente_id = 'd0000000-0000-4000-8000-000000000005' from public.contratos where id = (select id from public.contratos where titulo = 'Teste Fase5 avença')),
  'o cliente do contrato vem do local'
);
select pg_temp.recusado(
  $q$update public.contratos set agendado_ate = current_date + 365 where id = (select id from public.contratos where titulo = 'Teste Fase5 avença')$q$,
  'ninguém mexe à mão no que já foi gerado'
);
update public.contratos set frequencia = 'quinzenal' where id = (select id from public.contratos where titulo = 'Teste Fase5 avença');
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')) = 5,
  'mudar a frequência refaz as visitas futuras (a de hoje fica)'
);
update public.contratos set estado = 'suspenso' where id = (select id from public.contratos where titulo = 'Teste Fase5 avença');
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')) = 1,
  'suspender tira as visitas futuras da agenda'
);
update public.contratos set estado = 'ativo' where id = (select id from public.contratos where titulo = 'Teste Fase5 avença');
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')) = 5
  and (select count(*) from public.cobrancas where contrato_id = (select id from public.contratos where titulo = 'Teste Fase5 avença')) = 1,
  'reativar volta a agendar e não cobra o mês duas vezes'
);
select pg_temp.recusado(
  $q$delete from public.contratos where id = (select id from public.contratos where titulo = 'Teste Fase5 avença')$q$,
  'contrato com visitas ou cobranças não se apaga (termina-se)'
);

-- Cobranças e pagamentos.
select pg_temp.recusado(
  $q$insert into public.cobrancas (cliente_id, origem, descricao, valor)
     values ('d0000000-0000-4000-8000-000000000005', 'contrato', 'Teste Fase5 falsa', 10)$q$,
  'cobrança de contrato só pela geração automática'
);
insert into public.cobrancas (local_id, descricao, valor, data_vencimento)
select l.id, 'Teste Fase5 cobrança', 100, current_date + 10
from public.locais l where l.nome = 'Pátio e terraço';
select pg_temp.verificar(
  (select cliente_id = 'd0000000-0000-4000-8000-000000000005' and origem = 'avulsa' from public.cobrancas
   where id = (select id from public.cobrancas where descricao = 'Teste Fase5 cobrança')),
  'cobrança avulsa: o cliente vem do local'
);
insert into public.pagamentos (cobranca_id, valor, metodo) values ((select id from public.cobrancas where descricao = 'Teste Fase5 cobrança'), 40, 'numerario');
select pg_temp.verificar(
  (select estado = 'parcial' and em_divida = 60 from public.cobrancas_com_saldo where id = (select id from public.cobrancas where descricao = 'Teste Fase5 cobrança')),
  'pagamento parcial'
);
select pg_temp.recusado(
  $q$insert into public.pagamentos (cobranca_id, valor) values ((select id from public.cobrancas where descricao = 'Teste Fase5 cobrança'), 60.01)$q$,
  'não se paga mais do que está em dívida'
);
insert into public.pagamentos (cobranca_id, valor) values ((select id from public.cobrancas where descricao = 'Teste Fase5 cobrança'), 60);
select pg_temp.verificar(
  (select estado = 'paga' and em_divida = 0 from public.cobrancas_com_saldo where id = (select id from public.cobrancas where descricao = 'Teste Fase5 cobrança')),
  'cobrança paga'
);
select pg_temp.recusado(
  $q$update public.cobrancas set valor = 90 where id = (select id from public.cobrancas where descricao = 'Teste Fase5 cobrança')$q$,
  'o valor da cobrança não desce abaixo do que já foi pago'
);
select pg_temp.recusado(
  $q$delete from public.cobrancas where id = (select id from public.cobrancas where descricao = 'Teste Fase5 cobrança')$q$,
  'cobrança com pagamentos não se apaga'
);
insert into public.trabalhos (local_id, titulo, data, contrato_id)
select l.id, 'Teste Fase5 trabalho', current_date + 3, 'a6000000-0000-4000-8000-000000000001'
from public.locais l where l.nome = 'Pátio e terraço';
select pg_temp.verificar(
  (select contrato_id is null from public.trabalhos where titulo = 'Teste Fase5 trabalho'),
  'só a geração liga um trabalho a um contrato'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Chefe da Equipa Verde (Rui): não vê dinheiro
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.contratos) = 0, 'chefe NÃO vê contratos');
select pg_temp.verificar((select count(*) from public.cobrancas) = 0, 'chefe NÃO vê cobranças');
select pg_temp.verificar((select count(*) from public.pagamentos) = 0, 'chefe NÃO vê pagamentos');
select pg_temp.verificar((select count(*) from public.cobrancas_com_saldo) = 0, 'chefe NÃO vê saldos');
select pg_temp.verificar((select count(*) from public.dividas_clientes) = 0, 'chefe NÃO vê dívidas');
select pg_temp.verificar(
  (select count(*) from public.trabalhos where contrato_id is not null) = 12,
  'chefe vê na agenda as visitas dos contratos da sua equipa'
);
select pg_temp.recusado($q$select public.gerar_contratos()$q$, 'chefe NÃO gera contratos');
select pg_temp.recusado($q$select app.gerar_contratos()$q$, 'a geração interna não está exposta');
select pg_temp.recusado(
  $q$insert into public.contratos (local_id, titulo, data_inicio, valor_mensal)
     select id, 'Teste Fase5 do chefe', current_date, 1 from public.locais limit 1$q$,
  'chefe NÃO cria contratos'
);
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------
-- Colaborador (Tiago)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar((select count(*) from public.contratos) = 0, 'colaborador NÃO vê contratos');
select pg_temp.verificar((select count(*) from public.cobrancas_com_saldo) = 0, 'colaborador NÃO vê cobranças');
select pg_temp.verificar((select count(*) from public.pagamentos) = 0, 'colaborador NÃO vê pagamentos');
select pg_temp.verificar((select count(*) from public.dividas_clientes) = 0, 'colaborador NÃO vê dívidas');
select pg_temp.recusado($q$select public.gerar_contratos()$q$, 'colaborador NÃO gera contratos');
select pg_temp.recusado(
  $q$insert into public.pagamentos (cobranca_id, valor) values ('a7000000-0000-4000-8000-000000000001', 1)$q$,
  'colaborador NÃO regista pagamentos'
);
reset role;
select set_config('request.jwt.claims', '', true);

rollback;
