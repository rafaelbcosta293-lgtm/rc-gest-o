-- Número de sócio: identifica cada cliente de forma legível e única, no
-- formato "<código do estúdio><ano de inscrição a 2 dígitos><número
-- sequencial do cliente nesse estúdio, a 3 dígitos>" — ex.: o cliente
-- número 201 de sempre em Fátima, inscrito em 2024, fica com o número
-- F24201. O número sequencial nunca reinicia por ano, é sempre
-- crescente dentro do mesmo estúdio.

alter table public.estudios
  add column if not exists codigo_socio char(1) not null default '';
alter table public.estudios
  add column if not exists proximo_numero_socio integer not null default 1;

update public.estudios set codigo_socio = 'F' where slug = 'fatima';
update public.estudios set codigo_socio = 'L' where slug = 'leiria';

alter table public.clientes
  add column if not exists numero_socio text unique;

-- Atribui automaticamente o número seguinte do estúdio ao criar um
-- cliente — exceto quando já vem definido (ex.: importar clientes que
-- já têm um número de sócio atribuído na vida real), caso em que se
-- respeita o valor dado e não se consome um número novo.
-- security definer: o incremento em "estudios" é um detalhe interno,
-- não deve depender de quem está a criar o cliente ter permissão para
-- editar a tabela "estudios" diretamente.
create or replace function public.gerar_numero_socio()
returns trigger
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_numero integer;
  v_ano integer;
begin
  if new.numero_socio is not null then
    return new;
  end if;

  update public.estudios
    set proximo_numero_socio = proximo_numero_socio + 1
    where id = new.estudio_id
    returning codigo_socio, proximo_numero_socio - 1 into v_codigo, v_numero;

  v_ano := extract(year from coalesce(new.inicio_contrato, current_date))::integer % 100;

  new.numero_socio := v_codigo || lpad(v_ano::text, 2, '0') || lpad(v_numero::text, 3, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gerar_numero_socio on public.clientes;
create trigger trg_gerar_numero_socio
  before insert on public.clientes
  for each row
  execute function public.gerar_numero_socio();
