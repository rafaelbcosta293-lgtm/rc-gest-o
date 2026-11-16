-- Eliminar um instrutor sem perder o histórico.
--
-- As escalas, o registo de horas, as férias e as ausências estão ligadas
-- à ficha do instrutor: se a ficha fosse mesmo apagada, iam com ela. Por
-- isso "eliminar" passa a ser arquivar: a ficha fica marcada com a data
-- em que foi eliminada, deixa de aparecer na equipa e em todas as
-- escolhas, e a conta de acesso é destruída (email, palavra-passe e
-- login). A linha fica só para o histórico continuar a dizer de quem é.
--
-- (A função desligar_perfil_do_historico, da migração anterior, deixou
-- de ser usada pela aplicação.)
alter table public.perfis add column if not exists eliminado_em timestamptz;
comment on column public.perfis.eliminado_em is 'Instrutor eliminado: deixa de aparecer na equipa e de poder entrar; a linha fica só como arquivo, para o histórico (escalas, horas, férias, ausências) continuar a dizer de quem é.';
