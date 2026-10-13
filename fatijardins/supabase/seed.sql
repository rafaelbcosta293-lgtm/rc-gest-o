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
