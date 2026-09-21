-- A migração anterior (0002) acrescentou a coluna "minuto" à escala para
-- suportar turnos de meia em meia hora, mas esqueceu-se de atualizar a
-- chave única da tabela — essa continuava a ser (estudio_id, data, hora,
-- pt_id), sem contar com o minuto. Resultado: o mesmo instrutor não
-- conseguia ficar marcado às 07:00 E às 07:30 no mesmo dia, porque para a
-- base de dados isso contava como o mesmo registo repetido — daí o erro
-- "duplicate key value violates unique constraint
-- escalas_estudio_id_data_hora_pt_id_key" ao guardar a escala.
--
-- Substitui essa chave por uma que também considera o minuto.

alter table public.escalas
  drop constraint if exists escalas_estudio_id_data_hora_pt_id_key;

alter table public.escalas
  add constraint escalas_estudio_id_data_hora_minuto_pt_id_key
  unique (estudio_id, data, hora, minuto, pt_id);
