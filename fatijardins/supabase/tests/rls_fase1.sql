-- =====================================================================
-- Testes de permissões (RLS) da fase 1.
-- Precisa dos dados de exemplo (supabase/seed.sql).
-- Corre tudo dentro de uma transação e desfaz no fim (rollback), por
-- isso pode ser executado no SQL Editor do Supabase sem alterar dados.
-- Se algum teste falhar, aparece um erro "FALHOU: …".
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

-- Muda para o utilizador indicado (como faria a Data API).
create function pg_temp.entrar(utilizador uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', utilizador, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

grant execute on function pg_temp.verificar(boolean, text) to authenticated, anon;
grant execute on function pg_temp.entrar(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- Sem sessão (anon): nenhuma tabela acessível
-- ---------------------------------------------------------------------
set local role anon;
do $$
begin
  perform count(*) from public.clientes;
  raise exception 'FALHOU: anon conseguiu ler clientes';
exception when insufficient_privilege then
  raise notice 'ok — anon não lê clientes';
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Gerente (Marta)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*) from public.clientes) = 8, 'gerente vê os 8 clientes');
select pg_temp.verificar((select count(*) from public.locais) = 12, 'gerente vê os 12 locais');
select pg_temp.verificar((select count(*) from public.colaboradores) = 7, 'gerente vê os 7 colaboradores');
select pg_temp.verificar((select count(*) from public.colaboradores_custos) = 7, 'gerente vê os custos/hora');
select pg_temp.verificar((select count(*) from public.ausencias) = 3, 'gerente vê todas as ausências');
insert into public.clientes (nome) values ('Cliente de teste (gerente)');
select pg_temp.verificar((select count(*) from public.clientes) = 9, 'gerente cria clientes');
update public.colaboradores_custos set custo_hora = 13 where colaborador_id = 'c0000000-0000-4000-8000-000000000004';
select pg_temp.verificar((select custo_hora from public.colaboradores_custos where colaborador_id = 'c0000000-0000-4000-8000-000000000004') = 13, 'gerente altera custo/hora');
do $$
begin
  update public.colaboradores set perfil = 'colaborador' where id = 'c0000000-0000-4000-8000-000000000001';
  raise exception 'FALHOU: foi possível ficar sem gerentes ativos';
exception when check_violation then
  raise notice 'ok — não é possível ficar sem gerentes ativos';
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Chefe de equipa (Rui — Equipa Verde)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.clientes) = 9, 'chefe vê os clientes');
select pg_temp.verificar((select count(*) from public.locais) = 12, 'chefe vê os locais');
select pg_temp.verificar((select count(*) from public.colaboradores_custos) = 0, 'chefe NÃO vê custos/hora');
select pg_temp.verificar((select count(*) from public.ausencias) = 1, 'chefe vê só as ausências da sua equipa');
insert into public.clientes (nome) values ('Cliente de teste (chefe)');
select pg_temp.verificar((select count(*) from public.clientes) = 10, 'chefe cria clientes');
delete from public.clientes where nome = 'Cliente de teste (gerente)';
select pg_temp.verificar((select count(*) from public.clientes) = 10, 'chefe NÃO apaga clientes');
update public.colaboradores set funcao = 'X' where id = 'c0000000-0000-4000-8000-000000000004';
select pg_temp.verificar((select funcao from public.colaboradores where id = 'c0000000-0000-4000-8000-000000000004') = 'Jardineiro', 'chefe NÃO altera colaboradores');
do $$
begin
  insert into public.colaboradores_custos (colaborador_id, custo_hora) values ('c0000000-0000-4000-8000-000000000004', 1);
  raise exception 'FALHOU: chefe conseguiu escrever custos/hora';
exception when insufficient_privilege then
  raise notice 'ok — chefe não escreve custos/hora';
end;
$$;
reset role;

-- ---------------------------------------------------------------------
-- Colaborador (Tiago — Equipa Verde; Nuno tem férias marcadas)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
-- Desde a fase 2, o colaborador vê só os clientes e locais dos trabalhos de
-- hoje da sua equipa (3 nos dados de exemplo).
select pg_temp.verificar((select count(*) from public.clientes) = 3, 'colaborador só vê os clientes dos seus trabalhos de hoje');
select pg_temp.verificar((select count(*) from public.locais) = 3, 'colaborador só vê os locais dos seus trabalhos de hoje');
select pg_temp.verificar((select count(*) from public.colaboradores_custos) = 0, 'colaborador NÃO vê custos/hora');
select pg_temp.verificar((select count(*) from public.colaboradores) = 7, 'colaborador vê a lista da equipa');
select pg_temp.verificar((select count(*) from public.equipas) = 2, 'colaborador vê as equipas');
select pg_temp.verificar((select count(*) from public.ausencias) = 0, 'colaborador não vê ausências dos outros');
do $$
begin
  insert into public.clientes (nome) values ('Cliente de teste (colaborador)');
  raise exception 'FALHOU: colaborador conseguiu criar clientes';
exception when insufficient_privilege then
  raise notice 'ok — colaborador não cria clientes';
end;
$$;
reset role;

select pg_temp.entrar('a0000000-0000-4000-8000-000000000005');
select pg_temp.verificar((select count(*) from public.ausencias) = 1, 'colaborador vê as suas ausências');
reset role;

-- Um chefe que passa a colaborador deixa de ver as ausências da equipa,
-- mesmo que continue indicado como chefe (chefe_id) da equipa.
update public.colaboradores set perfil = 'colaborador' where id = 'c0000000-0000-4000-8000-000000000002';
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.ausencias) = 0, 'chefe despromovido deixa de ver as ausências da equipa');
reset role;
update public.colaboradores set perfil = 'chefe_equipa' where id = 'c0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------
-- Conta sem colaborador associado e colaborador inativo
-- ---------------------------------------------------------------------
select pg_temp.entrar('ffffffff-ffff-4fff-8fff-ffffffffffff');
select pg_temp.verificar((select count(*) from public.colaboradores) = 0, 'conta sem colaborador não vê nada');
select pg_temp.verificar((select count(*) from public.equipas) = 0, 'conta sem colaborador não vê equipas');
reset role;

update public.colaboradores set ativo = false where id = 'c0000000-0000-4000-8000-000000000006';
select pg_temp.entrar('a0000000-0000-4000-8000-000000000006');
select pg_temp.verificar((select count(*) from public.colaboradores) = 0, 'colaborador inativo perde o acesso');
reset role;

-- ---------------------------------------------------------------------
-- Apagar uma conta desliga o colaborador sem erro. O trigger do gerente
-- tem de ser security definer: o Supabase Auth apaga contas com o papel
-- supabase_auth_admin, que não pode ler public.colaboradores.
-- ---------------------------------------------------------------------
select pg_temp.verificar(
  (select prosecdef from pg_proc where oid = 'app.garantir_gerente_ativo'::regproc),
  'trigger do gerente é security definer (o Supabase Auth consegue apagar contas)'
);
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000005';
select pg_temp.verificar(
  (select user_id is null and ativo from public.colaboradores where id = 'c0000000-0000-4000-8000-000000000005'),
  'apagar a conta de um colaborador desliga-o sem erro'
);

rollback;
