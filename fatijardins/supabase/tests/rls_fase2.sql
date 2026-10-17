-- =====================================================================
-- Testes de permissões (RLS) da fase 2: trabalhos, registos, fotos,
-- horas (picagem) e Storage. Precisa dos dados de exemplo (seed.sql).
-- Corre numa transação e desfaz tudo no fim (rollback).
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

create function pg_temp.entrar(utilizador uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', utilizador, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Espera um erro de permissão (42501) ao correr o SQL indicado.
create function pg_temp.recusado(sql text, mensagem text)
returns void
language plpgsql
as $$
begin
  execute sql;
  raise exception 'FALHOU: %', mensagem;
exception when insufficient_privilege or check_violation or foreign_key_violation then
  raise notice 'ok — %', mensagem;
end;
$$;

grant execute on function pg_temp.verificar(boolean, text) to authenticated;
grant execute on function pg_temp.entrar(uuid) to authenticated;
grant execute on function pg_temp.recusado(text, text) to authenticated;

-- Trabalhos de exemplo: b…01-03 Verde hoje, b…04-05 Terra hoje, b…06 Verde
-- no último dia útil (concluído, com registo), b…07 Terra (idem),
-- b…08 Terra e b…09 Verde no próximo dia útil, b…10 sem equipa,
-- + 7 trabalhos futuros da série semanal do hotel (Terra).

-- ---------------------------------------------------------------------
-- Gerente
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*) from public.trabalhos where contrato_id is null) = 17, 'gerente vê todos os trabalhos (sem os dos contratos)');
select pg_temp.verificar((select count(*) from public.registos_horas) = 8, 'gerente vê todas as horas');
insert into public.trabalhos (local_id, cliente_id, titulo, data)
  select id, cliente_id, 'Teste sem equipa', current_date from public.locais limit 1;
select pg_temp.verificar(
  (select criado_por = 'c0000000-0000-4000-8000-000000000001' and cliente_id is not null from public.trabalhos where titulo = 'Teste sem equipa'),
  'gerente cria trabalho sem equipa (cliente e autor preenchidos sozinhos)'
);
reset role;

-- ---------------------------------------------------------------------
-- Chefe da Equipa Verde (Rui)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*) from public.trabalhos where contrato_id is null) = 5, 'chefe vê só os trabalhos da sua equipa (todas as datas, sem os dos contratos)');
select pg_temp.verificar((select count(*) from public.registos_trabalho) = 1, 'chefe vê só os registos da sua equipa');
select pg_temp.verificar((select count(*) from public.registos_horas) = 5, 'chefe vê as horas da sua equipa');
select pg_temp.recusado(
  $q$insert into public.trabalhos (local_id, cliente_id, titulo, data, equipa_id)
     select id, cliente_id, 'Teste', current_date, 'e0000000-0000-4000-8000-000000000002' from public.locais limit 1$q$,
  'chefe não cria trabalhos para outra equipa'
);
select pg_temp.recusado(
  $q$insert into public.trabalhos (local_id, cliente_id, titulo, data)
     select id, cliente_id, 'Teste', current_date from public.locais limit 1$q$,
  'chefe não cria trabalhos sem equipa'
);
insert into public.trabalhos (local_id, cliente_id, titulo, data, equipa_id)
  select id, cliente_id, 'Teste chefe', current_date + 1, 'e0000000-0000-4000-8000-000000000001' from public.locais limit 1;
select pg_temp.verificar((select count(*) from public.trabalhos where titulo = 'Teste chefe') = 1, 'chefe cria trabalhos para a sua equipa');
select pg_temp.recusado(
  $q$update public.trabalhos set equipa_id = 'e0000000-0000-4000-8000-000000000002' where id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'chefe não passa trabalhos para outra equipa'
);
delete from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000006';
select pg_temp.verificar((select count(*) from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000006') = 1, 'chefe não apaga trabalhos concluídos');
delete from public.trabalhos where titulo = 'Teste chefe';
select pg_temp.verificar((select count(*) from public.trabalhos where titulo = 'Teste chefe') = 0, 'chefe apaga trabalhos agendados da sua equipa');
select pg_temp.recusado(
  $q$insert into public.registos_horas (colaborador_id, entrada) values ('c0000000-0000-4000-8000-000000000004', now() - interval '2 hours')$q$,
  'chefe não introduz horas à mão'
);
reset role;

-- ---------------------------------------------------------------------
-- Colaborador da Equipa Verde (Tiago)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar((select count(*) from public.trabalhos where contrato_id is null) = 3, 'colaborador vê só os trabalhos de hoje da sua equipa');
select pg_temp.verificar((select count(*) from public.clientes) = 3, 'colaborador vê os clientes dos trabalhos de hoje');
select pg_temp.verificar((select count(*) from public.locais) = 3, 'colaborador vê os locais dos trabalhos de hoje');
select pg_temp.verificar((select count(*) from public.registos_trabalho) = 0, 'colaborador não vê registos de outros dias');
select pg_temp.verificar((select count(*) from public.registos_horas) = 2, 'colaborador vê só as suas horas');
select pg_temp.verificar((select count(*) from public.colaboradores_custos) = 0, 'colaborador continua sem ver custos');
update public.trabalhos set estado = 'em_curso' where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select estado = 'em_curso' from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000001'), 'colaborador inicia um trabalho');
select pg_temp.recusado(
  $q$update public.trabalhos set titulo = 'Mudado' where id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'colaborador não altera os dados do trabalho'
);
select pg_temp.recusado(
  $q$update public.trabalhos set estado = 'cancelado' where id = 'b0000000-0000-4000-8000-000000000002'$q$,
  'colaborador não cancela trabalhos'
);
insert into public.registos_trabalho (trabalho_id, tarefas_feitas) values ('b0000000-0000-4000-8000-000000000001', 'Relva cortada.');
select pg_temp.verificar(
  (select colaborador_id = 'c0000000-0000-4000-8000-000000000004' from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001'),
  'colaborador cria o registo do trabalho de hoje'
);
insert into public.registo_materiais (registo_id, descricao, quantidade, unidade)
  select id, 'Teste adubo', 2, 'kg' from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select count(*) from public.registo_materiais) = 1, 'colaborador regista materiais');
select pg_temp.recusado(
  $q$insert into public.registos_trabalho (trabalho_id) values ('b0000000-0000-4000-8000-000000000004')$q$,
  'colaborador não regista trabalhos de outra equipa'
);
insert into public.fotos (trabalho_id, momento, caminho) values ('b0000000-0000-4000-8000-000000000001', 'antes', 'trabalhos/b0000000-0000-4000-8000-000000000001/teste.jpg');
select pg_temp.verificar((select count(*) from public.fotos where colaborador_id = 'c0000000-0000-4000-8000-000000000004') = 1, 'colaborador junta fotos ao trabalho de hoje');
select pg_temp.recusado(
  $q$insert into public.fotos (trabalho_id, caminho) values ('b0000000-0000-4000-8000-000000000004', 'trabalhos/b0000000-0000-4000-8000-000000000004/x.jpg')$q$,
  'colaborador não junta fotos a trabalhos de outra equipa'
);
select pg_temp.recusado(
  $q$insert into public.registos_horas (colaborador_id, entrada) values ('c0000000-0000-4000-8000-000000000004', now())$q$,
  'colaborador não introduz horas à mão (só picagem)'
);

-- Storage: só nas pastas dos trabalhos que vê.
insert into storage.objects (bucket_id, name, owner_id) values ('fotos', 'trabalhos/b0000000-0000-4000-8000-000000000001/teste.jpg', 'a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar((select count(*) from storage.objects where bucket_id = 'fotos') = 1, 'colaborador envia fotos para a pasta do trabalho de hoje');
select pg_temp.recusado(
  $q$insert into storage.objects (bucket_id, name) values ('fotos', 'trabalhos/b0000000-0000-4000-8000-000000000004/x.jpg')$q$,
  'colaborador não envia fotos para trabalhos de outra equipa'
);
select pg_temp.recusado(
  $q$insert into storage.objects (bucket_id, name) values ('fotos', 'outra-pasta/x.jpg')$q$,
  'ninguém envia ficheiros para fora das pastas dos trabalhos'
);

-- Picagem
select pg_temp.verificar(
  (select trabalho_id = 'b0000000-0000-4000-8000-000000000002' and saida is null and origem = 'picagem'
     and entrada_latitude = 38.7006 and entrada_longitude = -9.4219
   from public.picar_entrada('b0000000-0000-4000-8000-000000000002', 38.700612, -9.421937)),
  'picar entrada num trabalho de hoje (localização com 4 casas decimais)'
);
select pg_temp.verificar((select estado = 'em_curso' from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000002'), 'picar entrada inicia o trabalho');
select pg_temp.recusado(
  $q$select public.picar_entrada('b0000000-0000-4000-8000-000000000004')$q$,
  'não se pica em trabalhos de outra equipa'
);
reset role;
-- (simular que a entrada começou há 2 horas, para a troca de trabalho ter duração)
update public.registos_horas set entrada = now() - interval '2 hours'
  where colaborador_id = 'c0000000-0000-4000-8000-000000000004' and saida is null;
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select public.picar_entrada('b0000000-0000-4000-8000-000000000003');
select pg_temp.verificar(
  (select count(*) from public.registos_horas where saida is null) = 1
  and (select trabalho_id from public.registos_horas where saida is null) = 'b0000000-0000-4000-8000-000000000003',
  'mudar de trabalho fecha o período anterior e abre outro'
);
select pg_temp.verificar((select saida is not null from public.picar_saida()), 'picar saída');
select pg_temp.verificar((select count(*) from public.registos_horas where saida is null) = 0, 'depois da saída não fica nada aberto');
reset role;

-- Entrada esquecida de outro dia: fecha no fim desse dia e fica "a rever".
-- (o Nuno picou a entrada às 20:00 do último dia útil e não picou a saída)
create temp table dia_anterior as
  select current_date - case extract(isodow from current_date)::int when 1 then 3 when 7 then 2 else 1 end as dia;
grant select on dia_anterior to authenticated;
insert into public.registos_horas (colaborador_id, entrada, origem)
  select 'c0000000-0000-4000-8000-000000000005', (dia + time '20:00') at time zone 'Europe/Lisbon', 'picagem' from dia_anterior;
select pg_temp.entrar('a0000000-0000-4000-8000-000000000005');
select pg_temp.verificar(
  (select r.a_rever and r.saida = (((d.dia + 1)::timestamp at time zone 'Europe/Lisbon') - interval '1 second')
   from public.picar_saida() r, dia_anterior d),
  'saída esquecida fecha às 23:59:59 desse dia e fica a rever'
);
reset role;

-- ---------------------------------------------------------------------
-- Reforços da revisão de segurança
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.recusado(
  $q$insert into public.fotos (trabalho_id, caminho) values ('b0000000-0000-4000-8000-000000000001', 'trabalhos/b0000000-0000-4000-8000-000000000002/isco.jpg')$q$,
  'foto só pode apontar para a pasta do próprio trabalho'
);
select pg_temp.recusado(
  $q$insert into public.fotos (trabalho_id, caminho) values ('b0000000-0000-4000-8000-000000000001', 'trabalhos/b0000000-0000-4000-8000-000000000001/../b0000000-0000-4000-8000-000000000002/isco.jpg')$q$,
  'foto com "../" no caminho é recusada'
);
select pg_temp.recusado(
  $q$insert into public.fotos (trabalho_id, caminho) values ('b0000000-0000-4000-8000-000000000001', 'outra/pasta/isco.jpg')$q$,
  'foto fora da pasta "trabalhos/" é recusada'
);
select pg_temp.recusado(
  $q$update public.fotos set colaborador_id = 'c0000000-0000-4000-8000-000000000006' where trabalho_id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'colaborador não muda o autor nem o caminho das fotos'
);
update public.registos_trabalho set notas = 'x', colaborador_id = 'c0000000-0000-4000-8000-000000000006'
  where trabalho_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select colaborador_id = 'c0000000-0000-4000-8000-000000000004' from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001'),
  'o autor do registo é sempre quem grava'
);
update public.registos_trabalho
  set assinatura_caminho = 'trabalhos/b0000000-0000-4000-8000-000000000001/assinatura-teste.png', assinatura_nome = 'Cliente', assinado_em = '2020-01-01'
  where trabalho_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.verificar(
  (select assinado_em > now() - interval '1 minute' from public.registos_trabalho where trabalho_id = 'b0000000-0000-4000-8000-000000000001'),
  'a data da assinatura é a do servidor'
);
select pg_temp.recusado(
  $q$update public.registos_trabalho set assinatura_caminho = null where trabalho_id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'colaborador não apaga uma assinatura feita'
);
select pg_temp.recusado(
  $q$update public.registos_trabalho set assinatura_caminho = 'trabalhos/b0000000-0000-4000-8000-000000000003/x.png' where trabalho_id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'colaborador não substitui uma assinatura feita'
);
select pg_temp.recusado(
  $q$update public.trabalhos set created_at = '2020-01-01' where id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'colaborador não altera outras colunas do trabalho (created_at)'
);
reset role;
select set_config('request.jwt.claims', '', true);
update public.trabalhos set estado = 'cancelado' where id = 'b0000000-0000-4000-8000-000000000003';
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.recusado(
  $q$update public.trabalhos set estado = 'concluido' where id = 'b0000000-0000-4000-8000-000000000003'$q$,
  'colaborador não conclui trabalhos cancelados'
);
select pg_temp.verificar((select count(*) from public.clientes where id = (select cliente_id from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000001')) = 1
  and (select count(*) from public.locais) = 2, 'colaborador deixa de ver o local de um trabalho cancelado');
reset role;
select pg_temp.entrar('a0000000-0000-4000-8000-000000000002');
select pg_temp.recusado(
  $q$update public.trabalhos set data = data + 1 where id = 'b0000000-0000-4000-8000-000000000006'$q$,
  'trabalho com registo/horas não muda de dia'
);
reset role;
select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select pg_temp.recusado(
  $q$delete from public.trabalhos where id = 'b0000000-0000-4000-8000-000000000006'$q$,
  'trabalho com horas/registo não se apaga'
);
reset role;

-- ---------------------------------------------------------------------
-- Nomes dos trabalhos no mapa de horas (função própria)
-- ---------------------------------------------------------------------
select pg_temp.entrar('a0000000-0000-4000-8000-000000000004');
select pg_temp.verificar(
  (select count(*) from public.detalhes_trabalhos_das_horas(current_date - 10, current_date) where trabalho_id = 'b0000000-0000-4000-8000-000000000006') = 1,
  'colaborador vê o nome dos trabalhos onde picou noutros dias'
);
select pg_temp.verificar(
  (select count(*) from public.detalhes_trabalhos_das_horas(current_date - 10, current_date) where trabalho_id = 'b0000000-0000-4000-8000-000000000007') = 0,
  'colaborador não vê o nome de trabalhos onde só outra equipa picou'
);
reset role;
select pg_temp.entrar('a0000000-0000-4000-8000-000000000003');
select pg_temp.verificar(
  (select count(*) from public.detalhes_trabalhos_das_horas(current_date - 10, current_date) where trabalho_id = 'b0000000-0000-4000-8000-000000000007') = 1
  and (select count(*) from public.detalhes_trabalhos_das_horas(current_date - 10, current_date) where trabalho_id = 'b0000000-0000-4000-8000-000000000006') = 0,
  'chefe vê os nomes dos trabalhos da sua equipa e não os das outras'
);
reset role;

-- ---------------------------------------------------------------------
-- Conta sem colaborador
-- ---------------------------------------------------------------------
select pg_temp.entrar('ffffffff-ffff-4fff-8fff-ffffffffffff');
select pg_temp.verificar((select count(*) from public.trabalhos) = 0, 'conta sem colaborador não vê trabalhos');
select pg_temp.recusado($q$select public.picar_entrada()$q$, 'conta sem colaborador não pica');
reset role;

-- anon não chama as funções de picagem
set local role anon;
do $$
begin
  perform public.picar_entrada();
  raise exception 'FALHOU: anon conseguiu picar';
exception when insufficient_privilege then
  raise notice 'ok — anon não pica';
end;
$$;
reset role;

rollback;
