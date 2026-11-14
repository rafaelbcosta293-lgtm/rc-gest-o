-- Gestão de despesas (só Administração): categorias editáveis (as do
-- Excel por omissão), estado pago/por pagar com vencimento, e despesas
-- recorrentes (renda, impostos, salários…) com aviso N dias antes.

create table public.despesa_categorias (
  id smallint generated always as identity primary key,
  nome text not null unique,
  ordem smallint not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.despesa_subcategorias (
  id integer generated always as identity primary key,
  categoria_id smallint not null references public.despesa_categorias(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (categoria_id, nome)
);

create table public.despesas_recorrentes (
  id uuid primary key default gen_random_uuid(),
  estudio_id smallint not null references public.estudios(id),
  categoria text not null,
  subcategoria text,
  descricao text,
  valor numeric(10,2) not null check (valor >= 0),
  periodicidade text not null default 'mensal'
    check (periodicidade in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  inicio date not null,
  fim date,
  dias_aviso smallint not null default 3 check (dias_aviso between 0 and 60),
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.despesas
  add column pago boolean not null default true,
  add column vencimento date,
  add column pago_em date,
  add column dias_aviso smallint check (dias_aviso between 0 and 60),
  add column recorrente_id uuid references public.despesas_recorrentes(id) on delete set null;

-- Uma ocorrência por vencimento de cada recorrente (anular uma não a
-- faz voltar a ser gerada).
create unique index despesas_recorrente_vencimento_uniq
  on public.despesas (recorrente_id, vencimento) where recorrente_id is not null;
create index despesas_por_pagar_idx on public.despesas (vencimento) where not pago and anulado_em is null;
create index despesa_subcategorias_categoria_idx on public.despesa_subcategorias (categoria_id);
create index despesas_recorrentes_estudio_idx on public.despesas_recorrentes (estudio_id);

alter table public.despesa_categorias enable row level security;
alter table public.despesa_subcategorias enable row level security;
alter table public.despesas_recorrentes enable row level security;
create policy admin_despesa_categorias on public.despesa_categorias for all
  using ((select public.e_admin())) with check ((select public.e_admin()));
create policy admin_despesa_subcategorias on public.despesa_subcategorias for all
  using ((select public.e_admin())) with check ((select public.e_admin()));
create policy admin_despesas_recorrentes on public.despesas_recorrentes for all
  using ((select public.e_admin())) with check ((select public.e_admin()));

-- Categorias e subcategorias do Excel (BD_Gastos).
insert into public.despesa_categorias (nome, ordem) values
  ('Recursos Humanos', 1),
  ('Amortizações/ Empréstimos', 2),
  ('Serviços', 3),
  ('Seguros e Licenças', 4),
  ('Impostos', 5),
  ('Consumíveis', 6),
  ('Publicidade / Marketing', 7),
  ('Manutenção', 8),
  ('Despesas Gerais', 9),
  ('Formação', 10),
  ('Outros não especificados', 11);

insert into public.despesa_subcategorias (categoria_id, nome)
select c.id, v.sub
from (values
  ('Recursos Humanos', 'Salário sócio'),
  ('Recursos Humanos', 'Seg. Social sócio'),
  ('Recursos Humanos', 'IRS'),
  ('Recursos Humanos', 'Seg. Social'),
  ('Recursos Humanos', 'Honorários PT1 - Carolina Ribeiro'),
  ('Recursos Humanos', 'Prémios/incent - Carolina Ribeiro'),
  ('Recursos Humanos', 'Honorários PT2 - Miguel Lapas'),
  ('Recursos Humanos', 'Honorários PT3 -'),
  ('Recursos Humanos', 'Honorários PT4 -'),
  ('Recursos Humanos', 'Nutricionista'),
  ('Recursos Humanos', 'Honorários PT1'),
  ('Recursos Humanos', 'Honorários PT2 - Daniela Gomes'),
  ('Recursos Humanos', 'Honorários PT3'),
  ('Amortizações/ Empréstimos', 'Renda'),
  ('Amortizações/ Empréstimos', 'Condomínio'),
  ('Amortizações/ Empréstimos', 'Amortização Empréstimo'),
  ('Amortizações/ Empréstimos', 'IRS Renda'),
  ('Serviços', 'Contabilidade'),
  ('Serviços', 'Energia/Luz'),
  ('Serviços', 'Vodafone'),
  ('Serviços', 'Be Water'),
  ('Serviços', 'Spotify'),
  ('Serviços', 'Advogado / Solicitador'),
  ('Serviços', 'Consultoria - Fitness Experts'),
  ('Serviços', 'Energia/Luz - alfaenergia'),
  ('Serviços', 'Net'),
  ('Serviços', 'SMAS'),
  ('Seguros e Licenças', 'MR Martins - H. Segurança no Trabalho'),
  ('Seguros e Licenças', 'Seguro Acidentes Pessoais - Clientes'),
  ('Seguros e Licenças', 'Seguro Acidentes de Trabalho'),
  ('Seguros e Licenças', 'Seguro Multiriscos'),
  ('Seguros e Licenças', 'ACISO'),
  ('Seguros e Licenças', 'AGAP Quota Anual'),
  ('Seguros e Licenças', 'Licenças Musicais - SPA'),
  ('Seguros e Licenças', 'Licenças Musicais - AUDIOGEST'),
  ('Seguros e Licenças', 'Licenças Sociedade'),
  ('Seguros e Licenças', 'Software'),
  ('Seguros e Licenças', 'Certidão Própria Permanente - Empresa'),
  ('Seguros e Licenças', 'Banco - Manutenção de contas'),
  ('Seguros e Licenças', 'Banco - Cartão de Débito (anuidade)'),
  ('Seguros e Licenças', 'Banco - Débitos diretos - comissão'),
  ('Seguros e Licenças', 'Banco - TPA - Renda Netpay'),
  ('Seguros e Licenças', 'Banco - TPA - Comissões'),
  ('Seguros e Licenças', 'Banco - Deposito à Ordem Empresa (Mbway)'),
  ('Impostos', 'IVA'),
  ('Impostos', 'IRC'),
  ('Impostos', 'RCBE'),
  ('Impostos', 'IES'),
  ('Impostos', 'IMI'),
  ('Consumíveis', 'Tinteiros'),
  ('Consumíveis', 'Café'),
  ('Consumíveis', 'Copos descartáveis'),
  ('Consumíveis', 'Material escritório'),
  ('Consumíveis', 'Gel de banho'),
  ('Consumíveis', 'Shampoo'),
  ('Consumíveis', 'Gel de mãos'),
  ('Consumíveis', 'Papel'),
  ('Consumíveis', 'Outros'),
  ('Consumíveis', 'Rolos marquesa/ creme'),
  ('Consumíveis', 'Detergente para roupa'),
  ('Publicidade / Marketing', 'MKT - Gestão redes socias'),
  ('Publicidade / Marketing', 'MKT - Anúncios'),
  ('Publicidade / Marketing', 'MKT - Merchandising'),
  ('Publicidade / Marketing', 'MKT - Gestão de tráfego'),
  ('Publicidade / Marketing', 'MKT - Vídeos'),
  ('Publicidade / Marketing', 'MKT - Site'),
  ('Publicidade / Marketing', 'MKT - Outros'),
  ('Publicidade / Marketing', 'MKT - Fotos'),
  ('Manutenção', 'Avença - Manut. Máquinas Fitness'),
  ('Manutenção', 'Avença - Manut. Ar Condicionado'),
  ('Manutenção', 'Avença - Alarmes'),
  ('Manutenção', 'Avença - Fixalarmes Extintores'),
  ('Manutenção', 'Avença - Fonte viva'),
  ('Manutenção', 'Avença - Manut. Máquinas'),
  ('Despesas Gerais', 'Despesas de Representação'),
  ('Despesas Gerais', 'Via Verde'),
  ('Despesas Gerais', 'Hoteis'),
  ('Despesas Gerais', 'Parques'),
  ('Outros não especificados', 'Equipamento foto/vídeo'),
  ('Outros não especificados', 'Assistência Bloco Alarmes'),
  ('Outros não especificados', 'Cópias de chaves'),
  ('Outros não especificados', 'X-Media'),
  ('Outros não especificados', 'Aniversário'),
  ('Outros não especificados', 'Acessórios audio'),
  ('Outros não especificados', 'Flores - Dia da mulher'),
  ('Outros não especificados', 'Prozis'),
  ('Outros não especificados', 'Equipamento de fitness'),
  ('Outros não especificados', 'Outros'),
  ('Outros não especificados', 'Leroy Merlin / Silvaluz'),
  ('Outros não especificados', 'Tinteiros'),
  ('Outros não especificados', 'Impressora / Portátil'),
  ('Outros não especificados', 'Roupa - Merchandising'),
  ('Outros não especificados', '3º Aniversário')
) as v(cat, sub)
join public.despesa_categorias c on c.nome = v.cat
on conflict do nothing;

-- E as que já aparecem nas despesas importadas (com outra grafia).
insert into public.despesa_subcategorias (categoria_id, nome)
select distinct c.id, d.subcategoria
from public.despesas d
join public.despesa_categorias c on c.nome = d.categoria
where d.subcategoria is not null
on conflict do nothing;
