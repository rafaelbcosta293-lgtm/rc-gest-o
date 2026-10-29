-- As 3 etapas novas do funil de 8 passos da especificação, entre as já
-- existentes (renomeadas na migração anterior).
alter type estado_lead add value 'Qualificada' after 'Contactada';
alter type estado_lead add value 'Falhou a experimental' after 'Experimental realizada';
alter type estado_lead add value 'Proposta / Em decisão' after 'Falhou a experimental';
