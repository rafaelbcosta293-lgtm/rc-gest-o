-- Lint "Unindexed foreign keys": 34 chaves estrangeiras sem índice —
-- cada JOIN ou "on delete" nestas colunas obriga a percorrer a tabela
-- toda em vez de ir direto às linhas certas. Aditivo, sem risco (só
-- acelera leituras; o único custo é um pouco mais de espaço e um
-- bocadinho mais lento a escrever, imperceptível neste volume de dados).

create index if not exists activities_criado_por_idx on public.activities (criado_por);
create index if not exists agenda_eventos_criado_por_idx on public.agenda_eventos (criado_por);
create index if not exists alerts_cliente_id_idx on public.alerts (cliente_id);
create index if not exists alerts_lead_id_idx on public.alerts (lead_id);
create index if not exists alerts_perfil_destinatario_idx on public.alerts (perfil_destinatario);
create index if not exists alerts_regra_chave_idx on public.alerts (regra_chave);
create index if not exists auditoria_alterado_por_idx on public.auditoria (alterado_por);
create index if not exists avaliacoes_pt_id_idx on public.avaliacoes (pt_id);
create index if not exists avaliacoes_validada_por_idx on public.avaliacoes (validada_por);
create index if not exists cenarios_simulador_criado_por_idx on public.cenarios_simulador (criado_por);
create index if not exists checklist_registos_pt_id_idx on public.checklist_registos (pt_id);
create index if not exists checklist_respostas_registo_id_idx on public.checklist_respostas (registo_id);
create index if not exists clientes_pt_principal_id_idx on public.clientes (pt_principal_id);
create index if not exists envios_aniversario_enviado_por_idx on public.envios_aniversario (enviado_por);
create index if not exists eventos_estudio_id_idx on public.eventos (estudio_id);
create index if not exists exercicios_categorias_categoria_id_idx on public.exercicios_categorias (categoria_id);
create index if not exists goals_criado_por_idx on public.goals (criado_por);
create index if not exists lead_contactos_feito_por_idx on public.lead_contactos (feito_por);
create index if not exists lead_stage_history_mudado_por_idx on public.lead_stage_history (mudado_por);
create index if not exists leads_cliente_id_idx on public.leads (cliente_id);
create index if not exists leads_responsavel_id_idx on public.leads (responsavel_id);
create index if not exists marcos_empresa_criado_por_idx on public.marcos_empresa (criado_por);
create index if not exists marcos_empresa_estudio_id_idx on public.marcos_empresa (estudio_id);
create index if not exists marketing_costs_estudio_id_idx on public.marketing_costs (estudio_id);
create index if not exists pagamentos_plano_id_idx on public.pagamentos (plano_id);
create index if not exists pagamentos_registado_por_idx on public.pagamentos (registado_por);
create index if not exists perfis_estudios_estudio_id_idx on public.perfis_estudios (estudio_id);
create index if not exists presencas_pt_id_idx on public.presencas (pt_id);
create index if not exists presencas_sessao_id_idx on public.presencas (sessao_id);
create index if not exists registos_pt_estudio_id_idx on public.registos_pt (estudio_id);
create index if not exists sessao_exercicios_exercicio_id_idx on public.sessao_exercicios (exercicio_id);
create index if not exists sessoes_estudio_id_idx on public.sessoes (estudio_id);
create index if not exists sessoes_pt_id_idx on public.sessoes (pt_id);
create index if not exists sessoes_validada_por_idx on public.sessoes (validada_por);
