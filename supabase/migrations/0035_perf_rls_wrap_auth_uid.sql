-- Lint "Auth RLS Initialization Plan": auth.uid() dentro de uma política
-- RLS é reavaliado LINHA A LINHA; (select auth.uid()) é avaliado uma vez
-- só por consulta (o Postgres trata-o como estável dentro da query) —
-- mesma lógica, mais rápido à escala. Sem mudar nenhuma regra de acesso,
-- só a forma de a escrever.

alter policy "editar_proprio_perfil" on public.perfis
  using (id = (select auth.uid()))
  with check ((id = (select auth.uid())) and (papel = meu_papel()));

alter policy "editar_registos_pt" on public.registos_pt
  using ((pt_id = (select auth.uid())) or e_gestao())
  with check ((pt_id = (select auth.uid())) or e_gestao());

alter policy "ler_registos_pt" on public.registos_pt
  using (e_gestao() or (pt_id = (select auth.uid())));

alter policy "criar_registos_pt" on public.registos_pt
  with check ((pt_id = (select auth.uid())) or e_gestao());

alter policy "cliente ve eventos publicados do seu estudio" on public.eventos
  using (
    (publicado = true)
    and (
      (estudio_id is null)
      or exists (
        select 1 from clientes c
        where c.auth_user_id = (select auth.uid()) and c.estudio_id = eventos.estudio_id
      )
    )
  );

alter policy "cliente ve a propria ficha" on public.clientes
  using (auth_user_id = (select auth.uid()));

alter policy "cliente ve as proprias avaliacoes" on public.avaliacoes
  using (
    exists (
      select 1 from clientes c
      where c.id = avaliacoes.cliente_id and c.auth_user_id = (select auth.uid())
    )
  );

alter policy "cliente ve as proprias presencas" on public.presencas
  using (
    exists (
      select 1 from clientes c
      where c.id = presencas.cliente_id and c.auth_user_id = (select auth.uid())
    )
  );

alter policy "config so equipa ou regulamento ao cliente" on public.config
  using (
    exists (select 1 from perfis where perfis.id = (select auth.uid()))
    or (
      (chave = 'regulamento'::text)
      and exists (select 1 from clientes c where c.auth_user_id = (select auth.uid()))
    )
  );
