-- "planos" só tinha uma política (admin_planos, FOR ALL, só admin) — ou
-- seja, ninguém além de administradores conseguia sequer LER a lista de
-- planos, incluindo gestão e PTs a registar um pagamento. Mesmo padrão
-- já usado nas restantes tabelas de referência (categorias, exercicios,
-- config, estudios, ...): escrita continua só para admin, leitura passa
-- a ser para todos os que têm sessão.
drop policy if exists "admin_planos" on public.planos;
create policy "escrever_planos" on public.planos for insert to authenticated with check (e_admin());
create policy "editar_planos" on public.planos for update to authenticated using (e_admin()) with check (e_admin());
create policy "apagar_planos" on public.planos for delete to authenticated using (e_admin());
create policy "ler_planos" on public.planos for select to authenticated using (true);
