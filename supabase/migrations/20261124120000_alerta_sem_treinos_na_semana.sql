-- O alerta "cliente sem treino agendado" passa a olhar para a semana: sem
-- treinos na semana em curso (qualquer dia) ou, de quinta a domingo, sem
-- treinos marcados para a semana seguinte. (A regra em si está em
-- lib/data/alertas.ts; aqui só muda o nome e a descrição que se leem.)
update public.alert_rules
  set nome = 'Cliente sem treinos na semana',
      descricao = 'Cliente ativo (ou pendente) sem treinos na semana em curso; de quinta a domingo, também sem treinos marcados para a semana seguinte.'
  where chave = 'cliente_sem_treino_agendado';
