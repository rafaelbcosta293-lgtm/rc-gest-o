-- Segurança das contas (antes de haver app de clientes):
--
-- 1) Contas criadas pelo registo público deixam de ganhar perfil de
--    equipa. Até aqui, toda a conta nova entrava como 'pt' — e bastava
--    um clique a dar-lhe um estúdio em Equipa para ver os dados desse
--    estúdio. Agora só as contas criadas pela Administração (que criam o
--    perfil elas próprias) pertencem à equipa.
-- 2) As tabelas que estavam abertas a "qualquer conta com sessão" passam
--    a exigir ser da equipa (ter perfil). Uma conta sem perfil não lê nem
--    altera nada.
-- 3) Alerta de acessos: sempre que uma conta ganha um estúdio, muda de
--    papel ou é criada, fica registado e a Administração vê um aviso.

create or replace function public.criar_perfil_novo_utilizador()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Já não cria perfil: quem cria contas de equipa é a Administração
  -- (que faz o perfil explicitamente). Contas do registo público ficam
  -- sem papel nem estúdio — não veem nada.
  return new;
end;
$function$;

create or replace function public.e_equipa()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from perfis where id = auth.uid());
$$;

alter policy "ler_alert_rules" on public.alert_rules using ((select e_equipa()));
alter policy "ler_ausencias" on public.ausencias using ((select e_equipa()));
alter policy "gerir_categorias" on public.categorias using ((select e_equipa())) with check ((select e_equipa()));
alter policy "ler_modelo" on public.checklist_modelo using ((select e_equipa()));
alter policy "ler_config" on public.config using ((select e_equipa()));
alter policy "gerir_envios" on public.envios_aniversario using ((select e_equipa())) with check ((select e_equipa()));
alter policy "ler_estado_sms_gateway" on public.estado_sms_gateway using ((select e_equipa()));
alter policy "ler_estudios" on public.estudios using ((select e_equipa()));
alter policy "gerir_exercicios" on public.exercicios using ((select e_equipa())) with check ((select e_equipa()));
alter policy "gerir_ex_cat" on public.exercicios_categorias using ((select e_equipa())) with check ((select e_equipa()));
alter policy "ler_perfis" on public.perfis using ((select e_equipa()));
alter policy "ler_perfis_estudios" on public.perfis_estudios using ((select e_equipa()));
alter policy "ler_planos" on public.planos using ((select e_equipa()));
alter policy "ver_servicos" on public.servicos using ((select e_equipa()));

create table if not exists public.alertas_acesso (
  id bigint generated always as identity primary key,
  ocorrido_em timestamptz not null default now(),
  perfil_id uuid references public.perfis(id) on delete set null,
  descricao text not null,
  feito_por uuid references public.perfis(id) on delete set null,
  visto_em timestamptz,
  visto_por uuid references public.perfis(id) on delete set null
);
create index if not exists alertas_acesso_por_ver_idx on public.alertas_acesso (ocorrido_em desc) where visto_em is null;
alter table public.alertas_acesso enable row level security;
create policy "admin_ve_alertas_acesso" on public.alertas_acesso for select using ((select e_admin()));
create policy "admin_marca_alertas_acesso" on public.alertas_acesso for update using ((select e_admin())) with check ((select e_admin()));

create or replace function public.registar_alerta_acesso()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nome text;
  v_estudio text;
  v_quem uuid := auth.uid();
begin
  if tg_table_name = 'perfis_estudios' then
    select nome into v_nome from perfis where id = new.perfil_id;
    select nome into v_estudio from estudios where id = new.estudio_id;
    insert into alertas_acesso (perfil_id, descricao, feito_por)
    values (new.perfil_id, format('%s ganhou acesso ao estúdio %s.', coalesce(v_nome, 'Uma conta'), coalesce(v_estudio, '?')), v_quem);
  elsif tg_op = 'INSERT' then
    insert into alertas_acesso (perfil_id, descricao, feito_por)
    values (new.id, format('Nova conta de equipa: %s (papel %s).', new.nome, new.papel), v_quem);
  elsif new.papel is distinct from old.papel then
    insert into alertas_acesso (perfil_id, descricao, feito_por)
    values (new.id, format('%s mudou de papel: %s → %s.', new.nome, old.papel, new.papel), v_quem);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alerta_acesso_estudio on public.perfis_estudios;
create trigger trg_alerta_acesso_estudio after insert on public.perfis_estudios
  for each row execute function public.registar_alerta_acesso();
drop trigger if exists trg_alerta_acesso_perfil on public.perfis;
create trigger trg_alerta_acesso_perfil after insert or update of papel on public.perfis
  for each row execute function public.registar_alerta_acesso();
