-- Alinha os nomes das etapas do funil de leads com a especificação do
-- CRM. Só renomeia (os dados existentes mantêm-se, só muda o rótulo);
-- as etapas novas (Qualificada, Falhou a experimental, Proposta / Em
-- decisão) entram numa migração seguinte, porque o Postgres não deixa
-- usar um valor de enum acabado de adicionar na mesma transação em que
-- foi criado.
alter type estado_lead rename value 'Novo' to 'Nova';
alter type estado_lead rename value 'Contactado' to 'Contactada';
alter type estado_lead rename value 'Visita marcada' to 'Experimental agendada';
alter type estado_lead rename value 'Visita feita' to 'Experimental realizada';
alter type estado_lead rename value 'Convertido' to 'Ganha';
alter type estado_lead rename value 'Perdido' to 'Perdida';
