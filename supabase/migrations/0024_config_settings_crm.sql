-- "settings" da especificação = alargar a "config" já existente (já
-- guarda seguro_anual, taxa_inscricao, validade_sessoes_dias, etc. —
-- os valores batem certo com a secção 1 da especificação). Só insere
-- chaves que ainda não existem, para nunca pisar um valor já em uso.
insert into public.config (chave, valor) values
  ('custo_hora_pt', '8,00'),
  ('max_clientes_bloco_exclusivo', '5'),
  ('desmarcacoes_seguidas_limite', '3'),
  ('desmarcacoes_acumuladas_limite', '6'),
  ('contrato_minimo_meses', '3'),
  ('reavaliacao_antecipada_treino_acompanhado', '25,00'),
  ('horario_estudio_inicio', '07:00'),
  ('horario_estudio_fim', '21:00'),
  ('preco_tp_1x_50min', '150,00'),
  ('preco_tp_1x_40min', '110,00'),
  ('preco_tp_2x_50min', '300,00'),
  ('preco_tp_2x_40min', '220,00'),
  ('preco_ta_1x', '60,00'),
  ('preco_ta_2x', '110,00'),
  ('preco_ta_3x', '150,00')
on conflict (chave) do nothing;
