-- =====================================================================
-- Fatijardins — dados de exemplo (fase 1)
--
-- Cria 6 contas de demonstração (palavra-passe: Fatijardins2026!),
-- 2 equipas, 7 colaboradores, 8 clientes e 12 locais.
--
-- ATENÇÃO: é só para testes. Antes de usar a app a sério, apague estas
-- contas em Authentication → Users (ou mude-lhes a palavra-passe).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Contas de acesso (auth.users + auth.identities)
-- ---------------------------------------------------------------------
with contas (id, email, nome) as (
  values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'gerente@example.com', 'Marta Fonseca'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'chefe.verde@example.com', 'Rui Carvalho'),
    ('a0000000-0000-4000-8000-000000000003'::uuid, 'chefe.terra@example.com', 'Sofia Lopes'),
    ('a0000000-0000-4000-8000-000000000004'::uuid, 'tiago@example.com', 'Tiago Mendes'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, 'nuno@example.com', 'Nuno Pires'),
    ('a0000000-0000-4000-8000-000000000006'::uuid, 'ines@example.com', 'Inês Rocha')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('Fatijardins2026!', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('nome', nome), now(), now(),
  '', '', '', '', '', '', '', ''
from contas;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id::text like 'a0000000-0000-4000-8000-%';

-- ---------------------------------------------------------------------
-- Equipas e colaboradores
-- ---------------------------------------------------------------------
insert into public.equipas (id, nome, cor, notas) values
  ('e0000000-0000-4000-8000-000000000001', 'Equipa Verde', '#15803d', 'Manutenção — Cascais, Estoril e Oeiras.'),
  ('e0000000-0000-4000-8000-000000000002', 'Equipa Terra', '#b45309', 'Obras e manutenção — Sintra e Lisboa.');

insert into public.colaboradores (id, user_id, nome, funcao, perfil, telemovel, email, equipa_id, ativo) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Marta Fonseca', 'Gerente', 'gerente', '912 345 001', 'gerente@example.com', null, true),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Rui Carvalho', 'Jardineiro chefe', 'chefe_equipa', '912 345 002', 'chefe.verde@example.com', 'e0000000-0000-4000-8000-000000000001', true),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'Sofia Lopes', 'Jardineira chefe', 'chefe_equipa', '912 345 003', 'chefe.terra@example.com', 'e0000000-0000-4000-8000-000000000002', true),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'Tiago Mendes', 'Jardineiro', 'colaborador', '912 345 004', 'tiago@example.com', 'e0000000-0000-4000-8000-000000000001', true),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'Nuno Pires', 'Jardineiro', 'colaborador', '912 345 005', 'nuno@example.com', 'e0000000-0000-4000-8000-000000000001', true),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'Inês Rocha', 'Jardineira', 'colaborador', '912 345 006', 'ines@example.com', 'e0000000-0000-4000-8000-000000000002', true),
  ('c0000000-0000-4000-8000-000000000007', null, 'Jorge Dias', 'Ajudante', 'colaborador', '912 345 007', null, 'e0000000-0000-4000-8000-000000000002', true);

update public.equipas set chefe_id = 'c0000000-0000-4000-8000-000000000002' where id = 'e0000000-0000-4000-8000-000000000001';
update public.equipas set chefe_id = 'c0000000-0000-4000-8000-000000000003' where id = 'e0000000-0000-4000-8000-000000000002';

insert into public.colaboradores_custos (colaborador_id, custo_hora) values
  ('c0000000-0000-4000-8000-000000000001', 25.00),
  ('c0000000-0000-4000-8000-000000000002', 16.50),
  ('c0000000-0000-4000-8000-000000000003', 16.50),
  ('c0000000-0000-4000-8000-000000000004', 12.00),
  ('c0000000-0000-4000-8000-000000000005', 12.00),
  ('c0000000-0000-4000-8000-000000000006', 12.50),
  ('c0000000-0000-4000-8000-000000000007', 10.00);

insert into public.ausencias (colaborador_id, tipo, data_inicio, data_fim, notas) values
  ('c0000000-0000-4000-8000-000000000005', 'ferias', current_date + 14, current_date + 25, 'Férias marcadas.'),
  ('c0000000-0000-4000-8000-000000000006', 'formacao', current_date + 7, current_date + 7, 'Formação em aplicação de fitofármacos.'),
  ('c0000000-0000-4000-8000-000000000007', 'doenca', current_date - 2, current_date + 2, null);

-- ---------------------------------------------------------------------
-- Clientes e locais
-- ---------------------------------------------------------------------
insert into public.clientes (id, nome, nif, pessoa_contacto, telemovel, telefone, email, morada, codigo_postal, localidade, notas) values
  ('d0000000-0000-4000-8000-000000000001', 'Helena Marques', '234567813', null, '913 111 222', null, 'helena.marques@example.com', 'Rua dos Lírios, 14', '2750-310', 'Cascais', 'Prefere contacto por SMS.'),
  ('d0000000-0000-4000-8000-000000000002', 'João e Teresa Antunes', '245632190', 'Teresa Antunes', '914 222 333', '214 000 111', 'antunes@example.com', 'Avenida do Mar, 220', '2765-001', 'Estoril', null),
  ('d0000000-0000-4000-8000-000000000003', 'Hotel Quinta das Palmeiras, Lda.', '510438725', 'Carla Nunes (direção)', '915 333 444', '219 000 222', 'direcao@example.com', 'Estrada da Serra, 1', '2710-100', 'Sintra', 'Faturação mensal; enviar fatura até dia 5.'),
  ('d0000000-0000-4000-8000-000000000004', 'Condomínio Jardins do Tejo', '901845620', 'Administração — Sr. Paulo', '916 444 555', null, 'condominio@example.com', 'Rua do Rio, 45', '2780-200', 'Oeiras', 'Chave do portão na portaria.'),
  ('d0000000-0000-4000-8000-000000000005', 'Ricardo Sousa', '278912346', null, '917 555 666', null, null, 'Travessa da Fonte, 3', '1400-150', 'Lisboa', null),
  ('d0000000-0000-4000-8000-000000000006', 'Escola Internacional do Restelo', '509873456', 'Eng. Sara Vieira', '918 666 777', '213 000 333', 'manutencao@example.com', 'Rua das Escolas, 10', '1400-200', 'Lisboa', 'Trabalhos só fora do horário letivo.'),
  ('d0000000-0000-4000-8000-000000000007', 'Margarida Coelho', '219876541', null, '919 777 888', null, 'margarida@example.com', 'Rua da Pena, 8', '2710-560', 'Sintra', null),
  ('d0000000-0000-4000-8000-000000000008', 'Condomínio Monte Estoril', '912345675', 'Administração — Dra. Lúcia', '910 888 999', null, 'monte.estoril@example.com', 'Avenida Sabóia, 500', '2765-278', 'Monte Estoril', null);

insert into public.locais (cliente_id, nome, morada, codigo_postal, localidade, latitude, longitude, area_m2, notas) values
  ('d0000000-0000-4000-8000-000000000001', 'Moradia', 'Rua dos Lírios, 14', '2750-310', 'Cascais', 38.700650, -9.421920, 450, 'Cão no quintal — tocar antes de entrar.'),
  ('d0000000-0000-4000-8000-000000000002', 'Casa principal', 'Avenida do Mar, 220', '2765-001', 'Estoril', 38.705410, -9.397610, 800, 'Rega automática com 6 setores.'),
  ('d0000000-0000-4000-8000-000000000002', 'Casa de férias', 'Rua das Gaivotas, 7', '2655-319', 'Ericeira', 38.963140, -9.415830, 300, null),
  ('d0000000-0000-4000-8000-000000000003', 'Jardins do hotel', 'Estrada da Serra, 1', '2710-100', 'Sintra', 38.797860, -9.390410, 6500, 'Entrada de serviço pelas traseiras.'),
  ('d0000000-0000-4000-8000-000000000003', 'Horta e pomar', 'Estrada da Serra, 1A', '2710-100', 'Sintra', 38.798500, -9.389200, 1200, null),
  ('d0000000-0000-4000-8000-000000000004', 'Espaços verdes comuns', 'Rua do Rio, 45', '2780-200', 'Oeiras', 38.691720, -9.310460, 2200, 'Chave do portão na portaria.'),
  ('d0000000-0000-4000-8000-000000000005', 'Pátio e terraço', 'Travessa da Fonte, 3', '1400-150', 'Lisboa', 38.703540, -9.206420, 90, 'Vasos e trepadeiras; acesso pelo 2.º andar.'),
  ('d0000000-0000-4000-8000-000000000006', 'Campus', 'Rua das Escolas, 10', '1400-200', 'Lisboa', 38.705980, -9.210880, 4000, 'Só fora do horário letivo.'),
  ('d0000000-0000-4000-8000-000000000006', 'Campo de jogos', 'Rua das Escolas, 12', '1400-200', 'Lisboa', 38.706500, -9.211900, 1800, 'Relvado natural.'),
  ('d0000000-0000-4000-8000-000000000007', 'Quintinha', 'Rua da Pena, 8', '2710-560', 'Sintra', 38.787600, -9.387800, 1500, null),
  ('d0000000-0000-4000-8000-000000000008', 'Jardim do condomínio', 'Avenida Sabóia, 500', '2765-278', 'Monte Estoril', 38.708900, -9.408300, 1600, null),
  ('d0000000-0000-4000-8000-000000000008', 'Piscina e envolvente', 'Avenida Sabóia, 500', '2765-278', 'Monte Estoril', 38.709100, -9.408000, 400, 'Não usar sopradores perto da piscina.');

-- =====================================================================
-- Fase 2 — trabalhos, registos e horas de exemplo (datas relativas a hoje)
-- =====================================================================
with
  dias as (
    select
      current_date as hoje,
      current_date - case extract(isodow from current_date)::int when 1 then 3 when 7 then 2 else 1 end as anterior,
      current_date + case extract(isodow from current_date)::int when 5 then 3 when 6 then 2 else 1 end as seguinte,
      date_trunc('week', current_date)::date as segunda
  ),
  l as (
    select l.id, l.nome, c.nome as cliente
    from public.locais l join public.clientes c on c.id = l.cliente_id
  )
insert into public.trabalhos (id, local_id, cliente_id, titulo, descricao, tipo, data, hora_inicio, duracao_prevista_min, equipa_id, ordem, estado, serie_id, criado_por)
select v.id::uuid, l.id, '00000000-0000-0000-0000-000000000000', v.titulo, v.descricao, v.tipo::public.tipo_trabalho, v.data, v.hora::time, v.duracao, v.equipa::uuid, v.ordem, v.estado::public.estado_trabalho, v.serie::uuid, 'c0000000-0000-4000-8000-000000000001'
from dias d
cross join lateral (values
  -- Equipa Verde — hoje
  ('b0000000-0000-4000-8000-000000000001', 'Helena Marques', 'Moradia', 'Manutenção quinzenal', 'Cortar relva, aparar sebes, limpar canteiros.', 'manutencao', d.hoje, '08:30', 120, 'e0000000-0000-4000-8000-000000000001', 1, 'agendado', null),
  ('b0000000-0000-4000-8000-000000000002', 'João e Teresa Antunes', 'Casa principal', 'Revisão da rega', 'Verificar os 6 setores e programar o horário de inverno.', 'manutencao', d.hoje, '11:00', 90, 'e0000000-0000-4000-8000-000000000001', 2, 'agendado', null),
  ('b0000000-0000-4000-8000-000000000003', 'Condomínio Monte Estoril', 'Jardim do condomínio', 'Manutenção semanal', 'Relva, folhas e limpeza dos caminhos.', 'manutencao', d.hoje, '14:00', 180, 'e0000000-0000-4000-8000-000000000001', 3, 'agendado', null),
  -- Equipa Terra — hoje
  ('b0000000-0000-4000-8000-000000000004', 'Hotel Quinta das Palmeiras, Lda.', 'Jardins do hotel', 'Manutenção semanal', 'Relvados, canteiros da entrada e poda ligeira.', 'manutencao', d.hoje, '08:00', 240, 'e0000000-0000-4000-8000-000000000002', 1, 'agendado', 'f0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000005', 'Margarida Coelho', 'Quintinha', 'Plantação de sebe', 'Plantar 20 m de sebe de eleagnus.', 'obra', d.hoje, '14:00', 180, 'e0000000-0000-4000-8000-000000000002', 2, 'agendado', null),
  -- Último dia útil (concluídos, com registo)
  ('b0000000-0000-4000-8000-000000000006', 'Condomínio Jardins do Tejo', 'Espaços verdes comuns', 'Manutenção semanal', 'Relva e sebes.', 'manutencao', d.anterior, '08:30', 240, 'e0000000-0000-4000-8000-000000000001', 1, 'concluido', null),
  ('b0000000-0000-4000-8000-000000000007', 'Escola Internacional do Restelo', 'Campo de jogos', 'Corte e adubação do relvado', null, 'manutencao', d.anterior, '08:00', 300, 'e0000000-0000-4000-8000-000000000002', 1, 'concluido', null),
  -- Próximo dia útil
  ('b0000000-0000-4000-8000-000000000008', 'Ricardo Sousa', 'Pátio e terraço', 'Tratamento dos vasos', 'Adubar, tratar a buganvília e limpar os vasos.', 'manutencao', d.seguinte, '09:00', 60, 'e0000000-0000-4000-8000-000000000002', 1, 'agendado', null),
  ('b0000000-0000-4000-8000-000000000009', 'João e Teresa Antunes', 'Casa de férias', 'Limpeza geral', 'Corte de relva e limpeza antes do inverno.', 'manutencao', d.seguinte, '09:00', 240, 'e0000000-0000-4000-8000-000000000001', 1, 'agendado', null),
  -- Por atribuir a uma equipa
  ('b0000000-0000-4000-8000-000000000010', 'Escola Internacional do Restelo', 'Campus', 'Poda de árvores', 'Poda das tílias junto ao portão.', 'manutencao', d.seguinte, null, 240, null, 1, 'agendado', null)
) as v(id, cliente, local, titulo, descricao, tipo, data, hora, duracao, equipa, ordem, estado, serie)
join l on l.cliente = v.cliente and l.nome = v.local;

-- Série semanal do hotel: mais 7 semanas, à mesma hora.
insert into public.trabalhos (local_id, cliente_id, titulo, descricao, tipo, data, hora_inicio, duracao_prevista_min, equipa_id, ordem, serie_id, criado_por)
select t.local_id, t.cliente_id, t.titulo, t.descricao, t.tipo, t.data + 7 * n, t.hora_inicio, t.duracao_prevista_min, t.equipa_id, t.ordem, t.serie_id, t.criado_por
from public.trabalhos t
cross join generate_series(1, 7) as n
where t.id = 'b0000000-0000-4000-8000-000000000004';

insert into public.registos_trabalho (id, trabalho_id, tarefas_feitas, notas, colaborador_id) values
  ('a1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'Relva cortada, sebes aparadas, folhas recolhidas.', 'O aspersor do setor 2 está partido — avisar o condomínio.', 'c0000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007', 'Corte do relvado e adubação de outono.', null, 'c0000000-0000-4000-8000-000000000003');

insert into public.registo_materiais (registo_id, descricao, quantidade, unidade) values
  ('a1000000-0000-4000-8000-000000000001', 'Sacos de recolha de verdes', 6, 'un'),
  ('a1000000-0000-4000-8000-000000000001', 'Fio de roçadora 3 mm', 15, 'm'),
  ('a1000000-0000-4000-8000-000000000002', 'Adubo de outono 12-6-24', 25, 'kg');

with d as (
  select current_date - case extract(isodow from current_date)::int when 1 then 3 when 7 then 2 else 1 end as dia
)
insert into public.registos_horas (colaborador_id, trabalho_id, entrada, saida, origem)
select v.colaborador::uuid, v.trabalho::uuid,
  (d.dia + v.entrada::time) at time zone 'Europe/Lisbon',
  (d.dia + v.saida::time) at time zone 'Europe/Lisbon',
  'picagem'
from d cross join (values
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', '08:25', '12:40'),
  ('c0000000-0000-4000-8000-000000000002', null, '13:35', '17:10'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006', '08:30', '12:40'),
  ('c0000000-0000-4000-8000-000000000004', null, '13:40', '18:20'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006', '08:30', '12:35'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000007', '07:55', '13:05'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000007', '08:00', '13:00'),
  ('c0000000-0000-4000-8000-000000000006', null, '14:00', '17:00')
) as v(colaborador, trabalho, entrada, saida);
