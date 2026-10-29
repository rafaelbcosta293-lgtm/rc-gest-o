-- Fase 5, painel 4.1 (Quadro do dia): "lead_contactos" só tinha um
-- "resultado" em texto livre (ex.: "não atendeu, marcou visita para
-- sexta"), sem nenhum sinal estruturado de sucesso/insucesso. A função
-- quadro_do_dia() já existente tentava adivinhar isso comparando
-- resultado = 'Atendeu'/'Respondeu', que nunca bate certo com texto
-- livre — na prática "contactos com sucesso" ficava sempre ~0. Fica
-- null nas linhas antigas (não há como saber ao certo) e passa a ser
-- preenchido pelo formulário a partir de agora.
alter table public.lead_contactos add column sucesso boolean;

-- Corrige também "vendas"/"valor_vendas": a versão anterior contava
-- qualquer lead com fecho_em = dia, mas fecho_em é gravado tanto para
-- "Ganha" como para "Perdida" (ver leads/actions.ts) — uma lead perdida
-- hoje estava a ser contada como venda.
create or replace function public.quadro_do_dia(p_estudio smallint, p_dia date default current_date)
returns table(
  leads_novas bigint,
  contactos bigint,
  contactos_sucesso bigint,
  sessoes_agendadas bigint,
  sessoes_para_hoje bigint,
  vendas bigint,
  valor_vendas numeric
)
language sql
stable
as $$
  select
    (select count(*) from leads where estudio_id = p_estudio and entrada = p_dia),
    (select count(*) from lead_contactos lc join leads l on l.id = lc.lead_id
      where l.estudio_id = p_estudio and lc.data = p_dia),
    (select count(*) from lead_contactos lc join leads l on l.id = lc.lead_id
      where l.estudio_id = p_estudio and lc.data = p_dia and lc.sucesso is true),
    (select count(*) from leads where estudio_id = p_estudio and visita_marcada_em = p_dia),
    (select count(*) from leads where estudio_id = p_estudio and visita_data = p_dia),
    (select count(*) from leads where estudio_id = p_estudio and fecho_em = p_dia and estado = 'Ganha'),
    (select coalesce(sum(valor_potencial), 0) from leads
      where estudio_id = p_estudio and fecho_em = p_dia and estado = 'Ganha');
$$;
