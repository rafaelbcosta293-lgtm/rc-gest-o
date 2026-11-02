-- Elimina políticas de SELECT redundantes: a condição de "gerir_X" já
-- cobre exatamente o mesmo (ou mais) do que "ler_X" fazia, por isso
-- "ler_X" nunca estava a dar acesso a mais ninguém — só fazia o
-- Postgres avaliar a mesma verificação duas vezes em cada leitura.
drop policy if exists "ler_sessao_ex" on public.sessao_exercicios;
drop policy if exists "ler_categorias" on public.categorias;
drop policy if exists "ler_exercicios" on public.exercicios;
drop policy if exists "ler_ex_cat" on public.exercicios_categorias;

-- Padrão "gerir_X é só gestão/admin (FOR ALL), ler_X é todos (SELECT)":
-- como o Postgres teria de avaliar as duas em cada leitura, troca-se
-- gerir_X por 3 políticas de escrita (mesma condição que já tinha) e
-- ler_X fica como a única política de SELECT.
drop policy if exists "gerir_alert_rules" on public.alert_rules;
create policy "escrever_alert_rules" on public.alert_rules for insert with check (e_gestao());
create policy "editar_alert_rules" on public.alert_rules for update using (e_gestao()) with check (e_gestao());
create policy "apagar_alert_rules" on public.alert_rules for delete using (e_gestao());

drop policy if exists "gerir_ausencias" on public.ausencias;
create policy "escrever_ausencias" on public.ausencias for insert to authenticated with check (e_gestao());
create policy "editar_ausencias" on public.ausencias for update to authenticated using (e_gestao()) with check (e_gestao());
create policy "apagar_ausencias" on public.ausencias for delete to authenticated using (e_gestao());

drop policy if exists "gerir_modelo" on public.checklist_modelo;
create policy "escrever_modelo" on public.checklist_modelo for insert to authenticated with check (e_gestao());
create policy "editar_modelo" on public.checklist_modelo for update to authenticated using (e_gestao()) with check (e_gestao());
create policy "apagar_modelo" on public.checklist_modelo for delete to authenticated using (e_gestao());

drop policy if exists "gerir_estado_sms_gateway" on public.estado_sms_gateway;
create policy "escrever_estado_sms_gateway" on public.estado_sms_gateway for insert with check (e_gestao());
create policy "editar_estado_sms_gateway" on public.estado_sms_gateway for update using (e_gestao()) with check (e_gestao());
create policy "apagar_estado_sms_gateway" on public.estado_sms_gateway for delete using (e_gestao());

drop policy if exists "gerir_estudios" on public.estudios;
create policy "escrever_estudios" on public.estudios for insert to authenticated with check (e_admin());
create policy "editar_estudios" on public.estudios for update to authenticated using (e_admin()) with check (e_admin());
create policy "apagar_estudios" on public.estudios for delete to authenticated using (e_admin());

drop policy if exists "gerir_perfis_estudios" on public.perfis_estudios;
create policy "escrever_perfis_estudios" on public.perfis_estudios for insert to authenticated with check (e_gestao());
create policy "editar_perfis_estudios" on public.perfis_estudios for update to authenticated using (e_gestao()) with check (e_gestao());
create policy "apagar_perfis_estudios" on public.perfis_estudios for delete to authenticated using (e_gestao());

drop policy if exists "gerir_config" on public.config;
create policy "escrever_config" on public.config for insert to authenticated with check (e_gestao());
create policy "editar_config" on public.config for update to authenticated using (e_gestao()) with check (e_gestao());
create policy "apagar_config" on public.config for delete to authenticated using (e_gestao());

-- perfis: igual ao padrão acima, mas o UPDATE tinha ainda uma segunda
-- política só para a própria pessoa editar o seu perfil
-- ("editar_proprio_perfil") — fica fundida (com OR) na política de update.
drop policy if exists "gerir_perfis" on public.perfis;
drop policy if exists "editar_proprio_perfil" on public.perfis;
create policy "escrever_perfis" on public.perfis for insert to authenticated with check (e_gestao());
create policy "editar_perfis" on public.perfis for update to authenticated
  using (e_gestao() or id = (select auth.uid()))
  with check (e_gestao() or (id = (select auth.uid()) and papel = meu_papel()));
create policy "apagar_perfis" on public.perfis for delete to authenticated using (e_gestao());

-- escalas: ler_escalas não era "true" (era tenho_estudio), por isso o
-- SELECT fundido junta as duas condições com OR em vez de ficar só com
-- a de ler_escalas.
drop policy if exists "gerir_escalas" on public.escalas;
drop policy if exists "ler_escalas" on public.escalas;
create policy "escrever_escalas" on public.escalas for insert to authenticated with check (e_gestao());
create policy "editar_escalas" on public.escalas for update to authenticated using (e_gestao()) with check (e_gestao());
create policy "apagar_escalas" on public.escalas for delete to authenticated using (e_gestao());
create policy "ler_escalas" on public.escalas for select to authenticated using (e_gestao() or tenho_estudio(estudio_id));

-- clientes: só havia duplicação no SELECT (equipa do estúdio vs. o
-- próprio cliente a ver a sua ficha) — funde-se numa só política.
drop policy if exists "cliente ve a propria ficha" on public.clientes;
drop policy if exists "ler_clientes" on public.clientes;
create policy "ler_clientes" on public.clientes for select
  using (tenho_estudio(estudio_id) or auth_user_id = (select auth.uid()));

-- avaliacoes e presencas: mesmo padrão de "equipa do estúdio OR o
-- próprio cliente", mas aqui a duplicação vinha de gerir_X (FOR ALL)
-- em vez de uma política de escrita já separada.
drop policy if exists "gerir_avaliacoes" on public.avaliacoes;
drop policy if exists "cliente ve as proprias avaliacoes" on public.avaliacoes;
create policy "escrever_avaliacoes" on public.avaliacoes for insert to authenticated
  with check (exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and tenho_estudio(c.estudio_id)));
create policy "editar_avaliacoes" on public.avaliacoes for update to authenticated
  using (exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and tenho_estudio(c.estudio_id)))
  with check (exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and tenho_estudio(c.estudio_id)));
create policy "apagar_avaliacoes" on public.avaliacoes for delete to authenticated
  using (exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and tenho_estudio(c.estudio_id)));
create policy "ler_avaliacoes" on public.avaliacoes for select
  using (
    exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and tenho_estudio(c.estudio_id))
    or exists (select 1 from clientes c where c.id = avaliacoes.cliente_id and c.auth_user_id = (select auth.uid()))
  );

drop policy if exists "gerir_presencas" on public.presencas;
drop policy if exists "cliente ve as proprias presencas" on public.presencas;
create policy "escrever_presencas" on public.presencas for insert to authenticated
  with check (exists (select 1 from clientes c where c.id = presencas.cliente_id and tenho_estudio(c.estudio_id)));
create policy "editar_presencas" on public.presencas for update to authenticated
  using (exists (select 1 from clientes c where c.id = presencas.cliente_id and tenho_estudio(c.estudio_id)))
  with check (exists (select 1 from clientes c where c.id = presencas.cliente_id and tenho_estudio(c.estudio_id)));
create policy "apagar_presencas" on public.presencas for delete to authenticated
  using (exists (select 1 from clientes c where c.id = presencas.cliente_id and tenho_estudio(c.estudio_id)));
create policy "ler_presencas" on public.presencas for select
  using (
    exists (select 1 from clientes c where c.id = presencas.cliente_id and tenho_estudio(c.estudio_id))
    or exists (select 1 from clientes c where c.id = presencas.cliente_id and c.auth_user_id = (select auth.uid()))
  );

-- eventos: mesma lógica, "equipa gere" (OR) "cliente vê publicados".
drop policy if exists "equipa gere eventos do seu estudio" on public.eventos;
drop policy if exists "cliente ve eventos publicados do seu estudio" on public.eventos;
create policy "escrever_eventos" on public.eventos for insert
  with check (e_gestao() and (estudio_id is null or tenho_estudio(estudio_id)));
create policy "editar_eventos" on public.eventos for update
  using (e_gestao() and (estudio_id is null or tenho_estudio(estudio_id)))
  with check (e_gestao() and (estudio_id is null or tenho_estudio(estudio_id)));
create policy "apagar_eventos" on public.eventos for delete
  using (e_gestao() and (estudio_id is null or tenho_estudio(estudio_id)));
create policy "ler_eventos" on public.eventos for select
  using (
    (e_gestao() and (estudio_id is null or tenho_estudio(estudio_id)))
    or (publicado = true and (estudio_id is null or exists (
      select 1 from clientes c where c.auth_user_id = (select auth.uid()) and c.estudio_id = eventos.estudio_id
    )))
  );
