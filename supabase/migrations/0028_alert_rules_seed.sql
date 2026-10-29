-- Regras do v1 do motor de alertas (Fase 4): só as que se conseguem
-- avaliar com dados já modelados na app (leads, clientes, presenças,
-- avaliações, pagamentos, agenda). As regras da especificação que
-- dependem de conceitos ainda não construídos (score de risco de
-- saída, manutenção de máquinas, ocupação do "Bloco Exclusivo",
-- escalas/horas da equipa, metas e churn mensal) ficam de fora desta
-- migração — entram quando essa base existir.
--
-- "limites" aqui é só para leitura humana/futura configuração a
-- partir de uma UI de definições; a rota de cron (app/api/cron/alertas)
-- usa os mesmos valores por omissão em lib/data/alertas.ts
-- (LIMITES_OMISSAO) e ainda não lê esta coluna.
insert into public.alert_rules (chave, nome, descricao, severidade_base, limites) values
  ('lead_sem_contacto', 'Lead nova sem contacto', 'Lead no estado "Nova" sem qualquer contacto registado.', 'Atenção', '{"horas_atencao": 2, "horas_critico": 24}'),
  ('lead_sem_seguimento', 'Lead sem seguimento', 'Lead em aberto sem atividade há vários dias, ou com a próxima ação vencida.', 'Crítico', '{"dias": 3}'),
  ('experimental_amanha', 'Experimental amanhã', 'Experimental agendada para o dia seguinte.', 'Atenção', '{}'),
  ('experimental_falhada_sem_reagendar', 'Experimental falhada sem reagendamento', 'Experimental falhada há mais de 48h sem nova data marcada.', 'Crítico', '{"horas": 48}'),
  ('experimental_sem_decisao', 'Experimental sem decisão', 'Experimental realizada há vários dias sem decisão (ganha/perdida).', 'Atenção', '{"dias": 5}'),
  ('cliente_sem_treino_agendado', 'Cliente ativo sem treino agendado', 'Cliente ativo sem nenhum evento de treino futuro na Agenda.', 'Crítico', '{}'),
  ('cliente_limite_desmarcacoes', 'Perto do limite de desmarcações', 'Desmarcações consecutivas ou acumuladas perto do limite.', 'Atenção', '{"consecutivas": 2, "acumuladas": 5}'),
  ('fim_experiencia_proximo', 'Fim do mês de experiência próximo', 'Faltam poucos dias para terminar o mês de experiência do cliente.', 'Atenção', '{"dias": 7}'),
  ('reavaliacao_atrasada', 'Reavaliação atrasada', 'A data da próxima reavaliação física já passou.', 'Atenção', '{}'),
  ('reavaliacao_proxima', 'Reavaliação próxima', 'A próxima reavaliação física aproxima-se.', 'Info', '{"dias": 14}'),
  ('aniversario_hoje', 'Aniversário hoje', 'O cliente faz anos hoje.', 'Info', '{}'),
  ('mensalidade_em_atraso', 'Mensalidade em atraso', 'Pagamento em atraso depois do dia definido do mês (nunca mostra valores).', 'Crítico', '{"dia_mes": 8}'),
  ('plano_a_expirar', 'Plano a expirar', 'O plano atual do cliente expira dentro de poucos dias.', 'Atenção', '{"dias": 7}')
on conflict (chave) do nothing;
